"""
Native apps through Windows UI Automation: the accessibility layer between an
app's own scripting and looking at pixels.

`inspect` lists a window's controls with short refs (like the browser's
observation); `act` works on one of them by ref: invoke, set a value, toggle,
select, expand, collapse or focus. A ref is re-found by its UI Automation
runtime id and must still carry the role and name it was observed with, so a
changed window is refused rather than guessed at. Most operations work without
moving the mouse or taking the foreground, so the person can keep working.
"""
from __future__ import annotations

import re
import time
from pathlib import Path

MAX_NODES = 2500
MAX_ELEMENTS = 250
# Controls a person acts on come first when a big window has to be trimmed.
PRIORITY = ("Edit", "ComboBox", "Button", "SplitButton", "MenuItem", "CheckBox", "RadioButton", "TabItem",
            "Hyperlink", "Document", "Slider", "Spinner")
MAX_DEPTH = 25
ROLES_WORTH_LISTING = {
    "Button", "CheckBox", "ComboBox", "Edit", "Hyperlink", "ListItem", "MenuItem", "RadioButton",
    "SplitButton", "TabItem", "TreeItem", "DataItem", "Document", "Slider", "Spinner", "Text",
    "HeaderItem", "Menu", "List", "Tab", "Table", "Header", "Group"}

_GATES = None


def _gates():
    """The same purchase/sensitive words the browser refuses or asks about (ocade_protocol.json)."""
    global _GATES
    if _GATES is None:
        import json
        gates = json.loads((Path(__file__).resolve().parent / "ocade_protocol.json").read_text())["gates"]
        _GATES = (re.compile(gates["purchase"], re.I), re.compile(gates["sensitive"], re.I))
    return _GATES


class _State:
    seq = 0
    held: dict = {}  # observationId -> {"window": runtime id, "refs": {ref: (runtime id, role, name)}}


def _uia():
    import uiautomation
    return uiautomation


def _window(title: str | None):
    auto = _uia()
    if not title:
        control = auto.GetForegroundControl()
        return control.GetTopLevelControl() if control else None
    wanted = title.lower()
    tops = auto.GetRootControl().GetChildren()
    for window in tops:
        if window.Name and wanted in window.Name.lower():
            return window
    # A modal dialog (Open, Save, Import) often sits under the window that owns it.
    for window in tops:
        try:
            for child in window.GetChildren():
                if child.ControlTypeName == "WindowControl" and child.Name and wanted in child.Name.lower():
                    return child
        except Exception:
            continue
    return None


def _value(control) -> str | None:
    try:
        pattern = control.GetValuePattern()
        return pattern.Value[:500] if pattern else None
    except Exception:
        return None


def _walk(window):
    """(control, depth) pairs, bounded."""
    stack, count = [(window, 0)], 0
    while stack and count < MAX_NODES:
        control, depth = stack.pop()
        count += 1
        yield control, depth
        if depth < MAX_DEPTH:
            try:
                children = control.GetChildren()
            except Exception:
                children = []
            stack.extend((child, depth + 1) for child in reversed(children))


def inspect(title: str | None = None, find: str | None = None) -> dict:
    auto = _uia()
    with auto.UIAutomationInitializerInThread():
        window = _window(title)
        if window is None:
            return {"status": "failed", "summary": "No such window is open"}
        _State.seq += 1
        obs_id = f"u{_State.seq}"
        refs, elements = {}, []
        for control, _depth in _walk(window):
            role = control.ControlTypeName.replace("Control", "")
            name = (control.Name or "").strip()
            if role not in ROLES_WORTH_LISTING or (not name and role not in ("Edit", "Document")):
                continue
            if find and find.lower() not in name.lower():
                continue
            ref = f"a{len(refs) + 1}"
            refs[ref] = (tuple(control.GetRuntimeId()), role, name)
            item = {"ref": ref, "role": role, "name": name[:120]}
            if control.AutomationId and not control.AutomationId.isdigit() or control.AutomationId in ("1", "2"):
                item["id"] = control.AutomationId[:60]  # tells same-named controls apart (a dialog's OK is "1")
            if not control.IsEnabled:
                item["disabled"] = True
            if control.HasKeyboardFocus:
                item["focused"] = True
            value = _value(control)
            if value is not None and not control.IsPassword:
                item["value"] = value
            if control.IsPassword:
                item["password"] = True
            elements.append(item)
        _State.held = {obs_id: {"window": tuple(window.GetRuntimeId()), "refs": refs}}
        if len(elements) > MAX_ELEMENTS:
            rank = {role: i for i, role in enumerate(PRIORITY)}
            kept = sorted(elements, key=lambda e: rank.get(e["role"], len(PRIORITY)))[:MAX_ELEMENTS]
            order = {id(e): i for i, e in enumerate(elements)}
            elements = sorted(kept, key=lambda e: order[id(e)])  # back in reading order
        return {"status": "done", "summary": f"Read the controls of “{window.Name[:80]}”",
                "observation": {"observationId": obs_id, "window": window.Name[:120],
                                "elements": elements, "complete": len(refs) <= MAX_ELEMENTS}}


def _by_runtime_id(runtime_id: tuple):
    """The observed window again: top level, or a dialog under one."""
    auto = _uia()
    for window in auto.GetRootControl().GetChildren():
        try:
            if tuple(window.GetRuntimeId()) == runtime_id:
                return window
            for child in window.GetChildren():
                if child.ControlTypeName == "WindowControl" and tuple(child.GetRuntimeId()) == runtime_id:
                    return child
        except Exception:
            continue
    return None


def _find(window, runtime_id: tuple):
    for control, _depth in _walk(window):
        try:
            if tuple(control.GetRuntimeId()) == runtime_id:
                return control
        except Exception:
            continue
    return None


def gate_at(x: int | None, y: int | None, confirmed: bool) -> dict | None:
    """
    The same hard rules for a click or keystrokes by coordinates: choosing the
    screen over a control must never be a way round them. What lies under the
    point (or has the keyboard, when x is None) and the controls holding it are
    read; a payment control is refused, a sensitive one asked about, a password
    field handed to the person.
    """
    try:
        auto = _uia()
    except ImportError:  # ponytail: Windows UI Automation only; macOS AX when the agent ships there
        return None
    purchase, sensitive = _gates()
    with auto.UIAutomationInitializerInThread():
        control = auto.GetFocusedControl() if x is None else auto.ControlFromPoint(x, y)
        if x is None:
            return ({"status": "human_required",
                     "summary": "A password is needed. Take over and type it yourself."}
                    if control is not None and control.IsPassword else None)
        # The control and the few holding it, up to the window or page itself (its title is not a button).
        for _ in range(4):
            if control is None or control.ControlTypeName in ("WindowControl", "PaneControl",
                                                              "DocumentControl"):
                break
            name = (control.Name or "").strip()
            if purchase.search(name):
                return {"status": "blocked", "summary": "JARVIS never completes a purchase or payment"}
            if sensitive.search(name) and not confirmed:
                return {"status": "needs_confirmation",
                        "summary": f"Confirm before JARVIS presses “{name[:60]}”"}
            control = control.GetParentControl()
    return None


def act(action: dict, confirmed: bool) -> dict:
    auto = _uia()
    held = _State.held.get(str(action.get("observationId", "")))
    ref = str(action.get("ref", ""))
    op = str(action.get("op", "invoke"))
    if not held or ref not in held["refs"]:
        return {"status": "stale", "summary": "That control is not in the current observation.",
                "observation": inspect().get("observation")}
    runtime_id, role, name = held["refs"][ref]
    with auto.UIAutomationInitializerInThread():
        window = _by_runtime_id(held["window"])
        control = _find(window, runtime_id) if window else None
        if control is None or control.ControlTypeName.replace("Control", "") != role \
                or (control.Name or "").strip() != name:
            return {"status": "stale", "summary": "That control changed or is gone.",
                    "observation": inspect(window.Name if window else None).get("observation")}
        purchase, sensitive = _gates()
        if op in ("invoke", "toggle", "select") and purchase.search(name):
            return {"status": "blocked", "summary": "JARVIS never completes a purchase or payment"}
        if op in ("invoke", "toggle", "select") and sensitive.search(name) and not confirmed:
            return {"status": "needs_confirmation", "summary": f"Confirm before JARVIS presses “{name[:60]}”"}
        if control.IsPassword:
            return {"status": "human_required", "summary": "A password is needed. Take over and type it yourself."}
        if not control.IsEnabled:
            return {"status": "failed", "summary": f"“{name[:60]}” is disabled"}
        text = str(action.get("value", ""))[:20_000]
        if op == "invoke":
            pattern = control.GetInvokePattern()
            if pattern:
                pattern.Invoke()
            else:
                control.Click(simulateMove=False)
        elif op == "set_value":
            pattern = control.GetValuePattern()
            if not pattern or pattern.IsReadOnly:
                return {"status": "failed", "summary": f"“{name[:60]}” does not take text; type into it instead"}
            pattern.SetValue(text)
            if (_value(control) or "") != text:
                return {"status": "failed", "summary": "The field did not take the text"}
        elif op == "toggle":
            control.GetTogglePattern().Toggle()
        elif op == "select":
            control.GetSelectionItemPattern().Select()
        elif op in ("expand", "collapse"):
            pattern = control.GetExpandCollapsePattern()
            pattern.Expand() if op == "expand" else pattern.Collapse()
        elif op == "focus":
            control.SetFocus()
        else:
            return {"status": "failed", "summary": "Unknown control operation"}
        time.sleep(0.4)
        title = window.Name
    after = inspect(title)
    return {"status": "done", "summary": f"{op.replace('_', ' ').capitalize()} “{name[:60] or role}”",
            "observation": after.get("observation")}
