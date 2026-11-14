"""Element references from `ui.inspect` (stable handles, P5) and what changed since the last look (C5).

`ui.inspect` names every element it lists `e1`, `e2`, ... and remembers which native element
(a UIA wrapper on Windows, an AXUIElement on macOS) and which identity (name, automationId,
controlType) each one had. An action that names a `ref` gets exactly that element back, so a
repeated label or an unnamed control is no longer ambiguous. A ref is valid only while the
element still has the identity it had when it was listed: anything else is refused before the
action is attempted.

An element whose identity is unique in the window keeps its ref across inspections (the idea of
mcp-windows' SnapshotDiffEngine, re-implemented): the planner may keep using what it already
knows, and `ui.inspect` with `changesOnly` sends only the elements that are new or changed plus
the refs that are gone. A label that repeats (an "OK" in two rows) gets a new ref every time,
since nothing proves which of the two an older ref meant.

`wait_for` is `ui.wait` for both desktops (C6): a bounded look for an element, never an action.
"""

from __future__ import annotations

import time
from collections import Counter

from .sandbox import Refused

IDENTITY = ("name", "automationId", "controlType")
_WINDOWS = 8  # windows kept, newest last; a ninth window forgets the oldest
_LAST_REF = 999  # the contract's ref pattern allows e1..e999
_kept: dict[str, dict] = {}  # window key -> {"refs": {ref: (native, identity, shown)}, "next": n}


def _identity(described: dict) -> tuple:
    return tuple(described.get(key, "") for key in IDENTITY)


def remember(window_key: str, found: list[tuple[object, dict]]) -> dict:
    """Give each (native element, description) its ref and keep them for this window. Returns
    what changed since the window's previous inspection: `changed` (refs new or different) and
    `removed` (refs no longer listed), or None for the window's first inspection."""
    old = _kept.pop(window_key, None)
    counts = Counter(_identity(d) for _, d in found)
    reuse = {}
    if old:
        old_counts = Counter(identity for _, identity, _ in old["refs"].values())
        reuse = {identity: ref for ref, (_, identity, _) in old["refs"].items()
                 if old_counts[identity] == 1 and counts[identity] == 1}
    following = old["next"] if old else 1
    if following + len(found) > _LAST_REF:  # numbers run out: start again, nothing reused
        reuse, following = {}, 1
    refs, changed = {}, []
    for native, described in found:
        identity = _identity(described)
        ref = reuse.get(identity)
        if ref is None:
            ref, following = f"e{following}", following + 1
        described["ref"] = ref
        shown = {k: v for k, v in described.items() if k != "ref"}
        refs[ref] = (native, identity, shown)
        if not old or ref not in old["refs"] or old["refs"][ref][2] != shown:
            changed.append(ref)
    _kept[window_key] = {"refs": refs, "next": following}
    while len(_kept) > _WINDOWS:
        _kept.pop(next(iter(_kept)))
    if not old:
        return None
    return {"changed": changed, "removed": [ref for ref in old["refs"] if ref not in refs]}


def recall(window_key: str, element: dict, describe) -> object:
    """The native element `element["ref"]` named, if it still has its identity, else a refusal.
    `describe(native)` reads its identity now; any other keys in `element` must agree too."""
    kept = _kept.get(window_key, {"refs": {}})["refs"].get(element["ref"])
    if kept is None:
        raise Refused("element_stale")
    native, identity, _ = kept
    identity = dict(zip(IDENTITY, identity))
    try:
        now = describe(native)
    except Exception:
        raise Refused("element_stale") from None
    if not isinstance(now, dict) or any(now.get(key, "") != identity[key] for key in IDENTITY):
        raise Refused("element_stale")
    if any(element.get(key) and element[key] != identity[key] for key in IDENTITY):
        raise Refused("element_stale")
    return native


def listing(found: list[tuple[object, dict]], diff: dict | None, changes_only: bool) -> dict:
    """What `ui.inspect` reports: every element, or with `changes_only` after an earlier
    inspection, only the new or changed ones, the refs that are gone and how many stayed."""
    elements = [described for _, described in found]
    if not (changes_only and diff is not None):
        return {"elements": elements}
    changed = set(diff["changed"])
    listed = [d for d in elements if d["ref"] in changed]
    return {"elements": listed, "removed": diff["removed"], "unchanged": len(elements) - len(listed)}


WAIT_POLL_S = 0.25


def wait_for(find, gone: bool, timeout_ms: int) -> dict:
    """`ui.wait` on both desktops: call `find()` (which finds the element or refuses) every
    quarter second until the element is there, or with `gone` until it or its window is gone,
    for at most `timeout_ms` (mcp-windows' DeterministicWait, re-implemented). Not met in time is
    a refusal, so the rest of a batch does not run against a screen that never arrived."""
    started = time.monotonic()
    while True:
        try:
            find()
            present = True
        except Refused as refusal:
            if refusal.code == "element_ambiguous":
                present = True  # more than one: it is there
            elif refusal.code in ("element_not_found", "element_stale") or (gone and refusal.code == "window_gone"):
                present = False
            else:
                raise
        waited = round((time.monotonic() - started) * 1000)
        if present != gone:
            return {"met": True, "waitedMs": waited}
        if waited >= timeout_ms:
            raise Refused("wait_timed_out")
        time.sleep(min(WAIT_POLL_S, (timeout_ms - waited) / 1000))
