"""Element references from the newest `ui.inspect` of each leased window (stable handles, P5).

`ui.inspect` names every element it lists `e1`, `e2`, ... and remembers which native element
(a UIA wrapper on Windows, an AXUIElement on macOS) and which identity (name, automationId,
controlType) each one had. An action that names a `ref` gets exactly that element back, so a
repeated label or an unnamed control is no longer ambiguous. A ref is valid only for the
window's newest inspection and only while the element still has the identity it had then:
anything else is refused before the action is attempted.
"""

from __future__ import annotations

from .sandbox import Refused

IDENTITY = ("name", "automationId", "controlType")
_WINDOWS = 8  # inspections kept, newest last; a ninth window forgets the oldest
_kept: dict[str, dict[str, tuple[object, dict]]] = {}


def remember(window_key: str, found: list[tuple[object, dict]]) -> None:
    """Give each (native element, description) a ref, in order, and keep them for this window."""
    refs = {}
    for native, described in found:
        ref = f"e{len(refs) + 1}"
        described["ref"] = ref
        refs[ref] = (native, {key: described.get(key, "") for key in IDENTITY})
    _kept.pop(window_key, None)
    _kept[window_key] = refs
    while len(_kept) > _WINDOWS:
        _kept.pop(next(iter(_kept)))


def recall(window_key: str, element: dict, describe) -> object:
    """The native element `element["ref"]` named, if it still has its identity, else a refusal.
    `describe(native)` reads its identity now; any other keys in `element` must agree too."""
    kept = _kept.get(window_key, {}).get(element["ref"])
    if kept is None:
        raise Refused("element_stale")
    native, identity = kept
    try:
        now = describe(native)
    except Exception:
        raise Refused("element_stale") from None
    if not isinstance(now, dict) or any(now.get(key, "") != identity[key] for key in IDENTITY):
        raise Refused("element_stale")
    if any(element.get(key) and element[key] != identity[key] for key in IDENTITY):
        raise Refused("element_stale")
    return native
