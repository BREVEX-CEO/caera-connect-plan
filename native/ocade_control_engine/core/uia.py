"""The Universal Windows Controller: drive ANY application through UI Automation.

WHY THIS EXISTS
---------------
The alternative is a tool per application — a Spotify tool, a Notepad tool, a
Chrome tool — and that approach loses by construction. Every new application is
new code, every UI redesign breaks the old code, and an application nobody
anticipated cannot be driven at all.

UI Automation is the way out. Windows already exposes, for almost every
application, the same structured description that screen readers use: what
controls exist, what they are called, whether they are enabled, and what can be
done to them. An application OCADE has never seen is therefore not a special
case — it is the ordinary case.

WHY NOT COORDINATE CLICKING
---------------------------
`pyautogui.click(x, y)` is a guess dressed as an action. It cannot tell a button
from the wallpaper, it silently hits whatever moved into that pixel, and it
cannot report what it pressed. UIA names the element before touching it and can
read it back afterwards, which is the only way an action can produce a receipt.

So coordinates are the LAST resort here, never the first, and taking them
requires the caller to ask for them explicitly (`allow_pointer_fallback`). When
they are used the receipt says so, because "clicked at (840, 517)" and "invoked
the Save button" are different claims and must not be reported the same way.

THE REF CONTRACT, AND WHY ELEMENTS CARRY A FINGERPRINT
------------------------------------------------------
`snapshot()` hands out refs (`e0`, `e1`, …) and the model acts on them by name.
Between the snapshot and the action the UI can change — a dialog opens, a list
re-sorts, a row is removed — and by then `e7` may be a different control at the
same index. Acting on the index alone would click the wrong thing and report
success.

Every element therefore carries a `fingerprint` of what it was, and `act()`
re-resolves the ref and compares. A mismatch is refused with `state_changed`,
which tells the caller to look again rather than leaving them with a confident
lie. This is the same reason `screen.observe` re-observes between steps.

WHAT IS DELIBERATELY NOT HERE
-----------------------------
No application knowledge of any kind: no window-title table, no per-app element
maps, no "if Spotify then". If this module ever needs to know which program it
is driving, the design has failed.
"""

from __future__ import annotations

import hashlib
import time
from typing import Any

# Controls that exist to be looked at, not operated. Filtering them keeps a tree
# small enough for a 3B model's context without hiding anything actionable.
_DECORATIVE = {"TitleBar", "Thumb", "Separator", "Image"}

# Anything at or below this size is a spacer, a gap or a 1px rule.
_MIN_EDGE = 4

# A tree bigger than this stops being useful to a small model: the useful
# elements get lost among menu items nobody asked about. Callers that need more
# should filter (`query`) rather than raise the ceiling.
_DEFAULT_LIMIT = 60
_MAX_LIMIT = 200


#: The methods that move the physical mouse. Named in ONE place so a receipt's
#: `pointerUsed` can never drift from what actually happened — the previous
#: spelling repeated the two names inline, which is how the two get out of step
#: the next time a rung is added to the ladder in `_try_patterns`.
_POINTER_METHODS = frozenset({"pointer_fallback", "uia_pointer_click"})


class UiaUnavailable(RuntimeError):
    """pywinauto/UIA could not be reached at all on this machine."""


class ElementGone(RuntimeError):
    """The ref no longer names the element it named at snapshot time."""


def force_foreground(hwnd: int) -> bool:
    """Bring a window to the front, working around Windows' focus-steal lock.

    `SetForegroundWindow` FAILS SILENTLY FROM A BACKGROUND PROCESS, and that is
    by design: Windows refuses focus changes from a process that does not
    already own the foreground, so an app cannot steal your keyboard mid-typing.
    OCADE is exactly such a process, so the plain call returns without raising
    and without moving anything.

    Measured live: "in wordpad type about cars" focused nothing, the typing then
    targeted whatever WAS in front — the browser — and a hundred words went into
    the wrong window while the receipt reported success.

    The documented way through is to attach this thread's input queue to the
    foreground window's. Two threads sharing an input queue count as one for the
    focus rules, so the call is permitted; the attachment is undone immediately
    afterwards. `ALT` is tapped first because a keystroke also clears the lock,
    and doing both costs nothing when one is enough.

    Returns whether the window IS in front afterwards — read back, not assumed.

    WHY THIS LIVES HERE AND NOT IN THE BRIDGE
    ------------------------------------------
    It used to be `ocade_bridge._force_foreground`, and `core/skills/whatsapp.py`
    reached UP into the host to call it — `import ocade_bridge` from inside a
    skill. That inverts the layering: the host imports the skills, so the skills
    importing the host is a cycle that only works because the bridge happens to
    have put its own directory on `sys.path` first. Anything that imported the
    skill on its own — a test, a script, a second host — got ImportError.

    Focus is a window concern, and this module is the window layer. Both callers
    now import it from here and nothing imports the host.
    """
    try:
        import win32api  # noqa: PLC0415
        import win32con  # noqa: PLC0415
        import win32gui  # noqa: PLC0415
        import win32process  # noqa: PLC0415
    except Exception as error:  # noqa: BLE001
        raise UiaUnavailable(
            "Windows control support is not installed in this environment."
        ) from error

    if win32gui.IsIconic(hwnd):
        win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)

    try:
        win32api.keybd_event(win32con.VK_MENU, 0, 0, 0)
        win32api.keybd_event(win32con.VK_MENU, 0, win32con.KEYEVENTF_KEYUP, 0)
    except Exception:  # noqa: BLE001, S110
        pass

    attached = False
    try:
        current = win32api.GetCurrentThreadId()
        target = win32process.GetWindowThreadProcessId(hwnd)[0]
        if current != target:
            attached = bool(win32process.AttachThreadInput(target, current, True))
    except Exception:  # noqa: BLE001
        attached = False

    try:
        win32gui.SetForegroundWindow(hwnd)
        win32gui.BringWindowToTop(hwnd)
        try:
            win32gui.SetFocus(hwnd)
        except Exception:  # noqa: BLE001, S110
            pass
    except Exception:  # noqa: BLE001, S110
        pass
    finally:
        if attached:
            try:
                current = win32api.GetCurrentThreadId()
                target = win32process.GetWindowThreadProcessId(hwnd)[0]
                win32process.AttachThreadInput(target, current, False)
            except Exception:  # noqa: BLE001, S110
                pass

    time.sleep(0.15)
    return win32gui.GetForegroundWindow() == hwnd


def _desktop():
    try:
        from pywinauto import Desktop  # noqa: PLC0415

        return Desktop(backend="uia")
    except Exception as error:  # noqa: BLE001
        raise UiaUnavailable(
            "UI Automation is not available in this Python environment. "
            "Install pywinauto and pywin32 into native/python-host/.venv."
        ) from error


def _window(hwnd: int):
    try:
        return _desktop().window(handle=hwnd)
    except Exception as error:  # noqa: BLE001
        raise UiaUnavailable(f"UI Automation could not attach to window {hwnd}.") from error


def _fingerprint(control_type: str, automation_id: str, name: str, depth: int) -> str:
    """Identity of an element by what it IS, not where it sits in the list.

    Position is excluded on purpose: a control that moves because something
    above it was removed is still the same control, and refusing to act on it
    would make ordinary UIs undrivable. Identity plus depth is strict enough to
    catch a genuinely different element and loose enough to survive a re-layout.
    """
    raw = f"{control_type}|{automation_id}|{name}|{depth}"
    return hashlib.sha256(raw.encode("utf-8", "replace")).hexdigest()[:12]


def _text_entry(element) -> tuple[bool, str | None]:
    """Can text actually be read out of, and written into, this control?

    THE ONE TEST THAT SEPARATES A TEXT BOX FROM A PAGE.
    -----------------------------------------------------
    Measured on Discord, which is Electron and therefore Chromium, and which is
    how every Electron chat app behaves:

        Document 'Friends'   focusable=True   value pattern=NO    1920x1040
        Edit     'Search'    focusable=True   value pattern=YES   1077x38

    Chromium publishes the WHOLE PAGE as one `Document` at the root of its
    accessibility tree. It is enabled, it is keyboard-focusable, and it is by
    far the largest element in the window — so any heuristic that ranks by size,
    or that trusts `role in (Edit, Document)`, picks the page body and calls it
    a message box. That is not a hypothetical: it is what OCADE did here before
    this function existed.

    Being READABLE is the honest discriminator, and it is app-agnostic. A
    control you can get text out of is a control that holds text. The page root
    is not, no matter how large or how focusable it looks.

    THE VALUE PATTERN ALONE MISSED EVERY RICH TEXT EDITOR.
    ------------------------------------------------------
    Measured on WordPad, whose document is a RICHEDIT50W:

        Document 'Rich Text Window'   get_value() -> raises   665x549

    A RichEdit exposes the UIA **TextPattern**, not the ValuePattern — the
    ValuePattern is for single-line-ish inputs. So `textEntry` came back false
    for the one control in the window that is entirely made of text, nothing
    downstream would type into it, and OCADE opened WordPad and then sat there.
    The same is true of Microsoft Word's document surface.

    So both patterns are tried. A control is a text control if EITHER answers.
    """
    try:
        value = element.get_value()
    except Exception:  # noqa: BLE001
        pass
    else:
        return True, value if isinstance(value, str) else None

    # TextPattern ONLY, and `window_text()` is deliberately NOT a fallback here.
    #
    # It was, briefly, and it broke the thing this function exists for:
    # `window_text()` succeeds on nearly every element — ribbon buttons, combo
    # boxes, the Chromium page root — so using it turned "is this a text
    # control" into "does this element exist". WordPad gained its document and
    # also fifteen ribbon controls, and Discord's two-million-pixel page root
    # would have become typable again. `iface_text` is the real pattern and
    # only real text surfaces implement it.
    try:
        text = element.iface_text.DocumentRange.GetText(-1)
    except Exception:  # noqa: BLE001
        return False, None
    return (True, text) if isinstance(text, str) else (False, None)


def _writable(element) -> bool:
    """Can text be WRITTEN here, not merely read out of it?

    READABLE AND WRITABLE ARE DIFFERENT QUESTIONS, AND CONFLATING THEM BROKE
    WHATSAPP. Accepting TextPattern as proof of a text control — needed for
    WordPad's RichEdit, which has no ValuePattern — also made Chromium's
    page-root `Document` qualify, because a whole web page is readable text.
    Measured on WhatsApp: `Document '(23) WhatsApp'` was selected as the search
    box and `set_text` was refused, because a page is not something you type
    into.

    ValuePattern is the write capability. A control that answers it takes text;
    one that only answers TextPattern can be read and, at best, typed into with
    keystrokes once focused. Callers choosing WHERE to type rank on this.
    """
    try:
        element.get_value()
    except Exception:  # noqa: BLE001
        return False
    return True


def _describe(element, depth: int) -> dict[str, Any] | None:
    """One element as plain data, or None when it is not worth showing."""
    try:
        info = element.element_info
        rect = info.rectangle
    except Exception:  # noqa: BLE001
        return None

    try:
        width, height = rect.width(), rect.height()
    except Exception:  # noqa: BLE001
        return None
    if width <= _MIN_EDGE or height <= _MIN_EDGE:
        return None

    control_type = info.control_type or "Unknown"
    if control_type in _DECORATIVE:
        return None

    name = (info.name or "").strip()
    automation_id = (info.automation_id or "").strip()

    try:
        enabled = bool(info.enabled)
    except Exception:  # noqa: BLE001
        enabled = True

    # Probed only for controls that could plausibly hold text. `get_value` is a
    # cross-process COM call, and running it on all 500-odd nodes of an Electron
    # tree turns a 200 ms observation into a multi-second one.
    text_entry = False
    writable = False
    if control_type in ("Edit", "Document", "ComboBox", "Custom"):
        text_entry, _ = _text_entry(element)
        if text_entry:
            writable = _writable(element)

    focusable = None
    try:
        focusable = bool(info.element.CurrentIsKeyboardFocusable)
    except Exception:  # noqa: BLE001
        focusable = None

    return {
        "role": control_type,
        "name": name[:160],
        "automationId": automation_id[:80],
        "enabled": enabled,
        "depth": depth,
        "bounds": {"x": rect.left, "y": rect.top, "width": width, "height": height},
        # Reported so a caller — or the model — can tell a real text box from a
        # page that merely contains one.
        "textEntry": text_entry,
        "writable": writable,
        "focusable": focusable,
        "fingerprint": _fingerprint(control_type, automation_id, name[:160], depth),
        "_element": element,
    }


def _walk(root, limit: int) -> list[dict[str, Any]]:
    """Breadth-first, so the most structurally important controls arrive first.

    Depth-first would spend the whole budget inside the first menu it found and
    never reach the button the user actually asked about.
    """
    out: list[dict[str, Any]] = []
    frontier = [(root, 0)]
    seen = 0

    while frontier and len(out) < limit:
        node, depth = frontier.pop(0)
        seen += 1
        # A runaway tree (some Electron apps expose thousands of nodes) must not
        # turn one observation into a multi-second stall.
        if seen > 2000:
            break
        try:
            children = node.children()
        except Exception:  # noqa: BLE001
            children = []
        for child in children:
            described = _describe(child, depth + 1)
            if described is not None:
                out.append(described)
                if len(out) >= limit:
                    break
            frontier.append((child, depth + 1))

    return out


def _is_shell_only(found: list[dict[str, Any]]) -> bool:
    """Is this a window frame with no application inside it yet?

    AN ELECTRON APP THAT HAS OPENED IS NOT AN ELECTRON APP THAT IS READY.
    Measured on Discord, eight seconds after launch:

        6 elements, every one of them role=Pane, five of them unnamed,
        zero Edit controls, zero Buttons, zero Text.

    Two minutes later the same window reported 200 elements across nine roles.
    Nothing was retried and no flag was passed — Chromium simply had not
    finished building its accessibility tree when the first read happened.

    That empty-looking tree is the dangerous case, because it is not an error.
    A caller gets a successful snapshot of a real window and concludes the app
    has no message box, no buttons and nothing to click. `settle` exists so the
    answer can be "not yet" instead of a confident and wrong "nothing here".
    """
    if not found:
        return True
    return all(row["role"] in ("Pane", "Window", "Group") for row in found)


def snapshot(
    hwnd: int,
    *,
    limit: int = _DEFAULT_LIMIT,
    query: str | None = None,
    protect=None,
    settle: float = 0.0,
) -> dict[str, Any]:
    """The accessibility tree of one window, as refs a model can act on.

    `protect` is the caller's credential-shape test. Element names are read from
    somebody's screen and can contain a password manager entry or a one-time
    code; those are masked here rather than at the caller, so no path can put
    them into a prompt by forgetting to.

    `settle` is how many seconds to keep re-reading while the window is still
    only a shell — see `_is_shell_only`. Zero by default, because most windows
    are ready the moment they exist and nobody should pay for a wait they do not
    need. Callers that have just launched something should pass a few seconds.
    """
    started = time.monotonic()
    limit = max(1, min(int(limit or _DEFAULT_LIMIT), _MAX_LIMIT))

    window = _window(hwnd)
    try:
        title = (window.window_text() or "").strip()
    except Exception:  # noqa: BLE001
        title = ""

    # The window's own extent, so a caller can reason about WHERE an element
    # sits — top half or bottom half — without guessing a screen size. A chat
    # composer is identified partly by being at the bottom of its window, and
    # "the bottom" is meaningless without this.
    window_bounds = None
    try:
        rect = window.rectangle()
        window_bounds = {
            "x": rect.left,
            "y": rect.top,
            "width": rect.width(),
            "height": rect.height(),
        }
    except Exception:  # noqa: BLE001
        window_bounds = None

    found = _walk(window, limit if not query else _MAX_LIMIT)

    waited_for = 0.0
    if settle > 0:
        deadline = time.monotonic() + min(float(settle), 30.0)
        while _is_shell_only(found) and time.monotonic() < deadline:
            time.sleep(0.4)
            found = _walk(_window(hwnd), limit if not query else _MAX_LIMIT)
        waited_for = round(time.monotonic() - started, 2)

    shell_only = _is_shell_only(found)

    if query:
        needle = query.strip().lower()
        found = [
            row
            for row in found
            if needle in row["name"].lower()
            or needle in row["automationId"].lower()
            or needle in row["role"].lower()
        ][:limit]

    elements = []
    for index, row in enumerate(found):
        name = row["name"]
        if protect is not None and name and protect(name):
            name = "«protected»"
        elements.append(
            {
                "ref": f"e{index}",
                "role": row["role"],
                "name": name,
                "automationId": row["automationId"],
                "enabled": row["enabled"],
                "bounds": row["bounds"],
                "textEntry": row["textEntry"],
                "writable": row["writable"],
                "focusable": row["focusable"],
                "fingerprint": row["fingerprint"],
            }
        )

    return {
        "hwnd": hwnd,
        "title": title[:256],
        "bounds": window_bounds,
        "elements": elements,
        "count": len(elements),
        "truncated": len(found) >= limit,
        # SAID OUT LOUD RATHER THAN LEFT TO BE INFERRED FROM A SMALL COUNT.
        # "This window has not published its contents yet" and "this window is
        # empty" produce the same short list and mean opposite things.
        "shellOnly": shell_only,
        "textEntryCount": sum(1 for e in elements if e["textEntry"]),
        "waitedForSeconds": waited_for,
        "elapsedMs": int((time.monotonic() - started) * 1000),
        "detail": (
            (
                f"{title[:60] or 'That window'} is open but has not published its "
                "contents to the accessibility tree yet. Give it a moment and look again."
            )
            if shell_only
            else (
                f"Read {len(elements)} actionable element(s) from "
                f"{title[:60] or 'the active window'}."
            )
        ),
    }


def _resolve(hwnd: int, ref: str, fingerprint: str | None, limit: int):
    """Turn a ref back into a live element, or refuse.

    Re-walks rather than caching. A cached handle can outlive the control it
    points at and then acts on freed state; re-walking costs milliseconds and
    cannot.
    """
    if not isinstance(ref, str) or not ref.startswith("e") or not ref[1:].isdigit():
        raise ElementGone(f"{ref!r} is not an element reference from a UI snapshot.")

    index = int(ref[1:])
    window = _window(hwnd)
    found = _walk(window, max(limit, index + 1))

    if index >= len(found):
        raise ElementGone(
            f"{ref} is no longer in this window — it now has {len(found)} element(s). "
            "Read the window again before acting."
        )

    row = found[index]
    if fingerprint and row["fingerprint"] != fingerprint:
        raise ElementGone(
            f"{ref} is now {row['role']} {row['name']!r}, which is not what was read before. "
            "The window changed; read it again before acting."
        )
    return row


def _try_patterns(
    element, action: str, text: str | None, allow_pointer: bool = False
) -> tuple[bool, str]:
    """Operate the control the way the control says it can be operated.

    Ordered most-specific first. `click` on a checkbox should toggle it, not
    invoke it, because a Toggle that is invoked reports success while the box
    stays unchecked.

    `click_input` IS GATED WITH THE POINTER FALLBACK, and that is deliberate.
    pywinauto resolves the element first, so it is not blind the way a raw
    coordinate click is — but it still drives the physical mouse across the
    user's screen. A caller that asked for accessibility-only control would
    otherwise get pointer movement without ever opting in, which makes the
    promise false. Whether the click was synthesised or physical is exactly the
    distinction `allow_pointer_fallback` exists to draw.
    """
    if action == "set_text":
        try:
            element.set_edit_text(text or "")
            return True, "value_pattern"
        except Exception:  # noqa: BLE001
            pass
        try:
            element.set_text(text or "")
            return True, "value_pattern"
        except Exception:  # noqa: BLE001
            return False, ""

    if action == "focus":
        try:
            element.set_focus()
            return True, "focus"
        except Exception:  # noqa: BLE001
            return False, ""

    if action == "expand":
        for attempt, label in ((lambda: element.expand(), "expand_collapse"),):
            try:
                attempt()
                return True, label
            except Exception:  # noqa: BLE001
                continue
        return False, ""

    # click / toggle / select all end up here.
    attempts = []
    if action in ("click", "toggle"):
        attempts.append((lambda: element.toggle(), "toggle_pattern"))
    if action in ("click", "select"):
        attempts.append((lambda: element.select(), "selection_pattern"))
    if action == "click":
        attempts.append((lambda: element.invoke(), "invoke_pattern"))
        if allow_pointer:
            attempts.append((lambda: element.click_input(), "uia_pointer_click"))

    for attempt, label in attempts:
        try:
            attempt()
            return True, label
        except Exception:  # noqa: BLE001
            continue
    return False, ""


def _state(row: dict[str, Any]) -> dict[str, Any]:
    """The small amount of element state that an action can be checked against."""
    element = row["_element"]
    state: dict[str, Any] = {"name": row["name"], "enabled": row["enabled"]}
    for reader, key in (
        (lambda: element.get_toggle_state(), "toggle"),
        (lambda: element.is_selected(), "selected"),
        (lambda: element.get_value(), "value"),
    ):
        try:
            state[key] = reader()
        except Exception:  # noqa: BLE001
            continue
    return state


def act(
    hwnd: int,
    ref: str,
    action: str,
    *,
    text: str | None = None,
    fingerprint: str | None = None,
    allow_pointer_fallback: bool = False,
    limit: int = _MAX_LIMIT,
) -> dict[str, Any]:
    """Operate one element, then read it back and say whether anything changed.

    THE RETURN IS A RECEIPT, NOT A CLAIM. `verified` is set from a second read
    after the action, never from the fact that the call did not raise. A control
    that accepted an invoke and did nothing is a failure the caller must see.
    """
    action = (action or "click").strip().lower()
    allowed = {"click", "toggle", "select", "set_text", "focus", "expand"}
    if action not in allowed:
        raise ElementGone(f"{action!r} is not a UI action. Use one of: {', '.join(sorted(allowed))}.")

    row = _resolve(hwnd, ref, fingerprint, limit)
    element = row["_element"]

    if not row["enabled"]:
        raise ElementGone(
            f"{row['role']} {row['name']!r} is disabled, so it cannot be {action}ed. "
            "Something else on screen has to happen first."
        )

    before = _state(row)
    ok, how = _try_patterns(element, action, text, allow_pointer_fallback)

    if not ok and allow_pointer_fallback and action in ("click", "toggle", "select"):
        # LAST RESORT, AND SAID OUT LOUD. Only reached when every accessibility
        # pattern refused, and only when the caller opted in. The receipt keeps
        # `how` as "pointer_fallback" so nobody reads this as a UIA action.
        try:
            bounds = row["bounds"]
            import pyautogui  # noqa: PLC0415

            pyautogui.click(
                bounds["x"] + bounds["width"] // 2,
                bounds["y"] + bounds["height"] // 2,
            )
            ok, how = True, "pointer_fallback"
        except Exception:  # noqa: BLE001
            ok, how = False, ""

    if not ok:
        raise ElementGone(
            f"{row['role']} {row['name']!r} did not accept '{action}'. It exposes no "
            "matching UI Automation pattern, so OCADE did not guess with the pointer."
        )

    # Let the application repaint before the check, or a correct action reads as
    # a failure purely because the check won the race.
    time.sleep(0.15)

    try:
        after_row = _resolve(hwnd, ref, None, limit)
        after = _state(after_row)
        changed = after != before
    except ElementGone:
        # The element disappearing is the strongest possible evidence that the
        # action landed — a dialog closed, a menu committed, a row was removed.
        after, changed = {"gone": True}, True

    pointer_used = how in _POINTER_METHODS
    return {
        "ref": ref,
        "action": action,
        "role": row["role"],
        "name": row["name"],
        "how": how,
        # STATED, NOT INFERRED FROM THE METHOD NAME.
        #
        # "pyautogui is strictly a last resort" is one of this product's
        # headline claims, and until now the only evidence for it in a receipt
        # was `how: "value_pattern"` — true, but it requires the reader to know
        # which of eight method names imply a mouse. A caller could not assert
        # on it and neither could a test. `pointerUsed` is the claim itself, as
        # a boolean, present on every action whether or not a pointer was near
        # it. `pointerFallbackUsed` is kept as its old name so existing readers
        # do not break.
        "pointerUsed": pointer_used,
        "pointerFallbackUsed": pointer_used,
        "before": before,
        "after": after,
        "verified": bool(changed),
        "detail": (
            f"{action} on {row['role']} {row['name']!r} via {how}; "
            + ("state changed." if changed else "state did NOT change.")
            + ("" if pointer_used else " The pointer was not moved.")
        ),
    }
