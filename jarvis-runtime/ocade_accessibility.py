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
        protocol = json.loads((Path(__file__).resolve().parent / "ocade_protocol.json").read_text())
        gates = protocol["gates"]
        _GATES = (re.compile(gates["purchase"], re.I), re.compile(gates["sensitive"], re.I),
                  frozenset(protocol["protectedApps"]))
    return _GATES


PROTECTED = {"status": "blocked",
             "summary": "JARVIS does not read or operate password managers, sign-in prompts or "
                        "security settings. Take over for this part."}


def _owner(control) -> str:
    import psutil
    try:
        return psutil.Process(control.ProcessId).name().lower()
    except psutil.NoSuchProcess:  # gone; an unreadable owner is raised, never taken as harmless
        return ""


def _protected(control) -> bool:
    """A password manager, a credential prompt or Windows Security owns this control, the window
    holding it, or (for Store apps, whose frame belongs to ApplicationFrameHost) the app inside it."""
    protected = _gates()[2]
    node = control
    for _ in range(8):  # an unreadable step raises: the caller refuses rather than guesses
        if node is None:
            break
        owner = _owner(node)
        if owner in protected:
            return True
        if owner == "applicationframehost.exe":
            if any(_owner(child) in protected for child in node.GetChildren()):
                return True
        node = node.GetParentControl()
    return False


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


def _walk(window, cancel=None):
    """(control, depth) pairs, bounded, and ended by STOP."""
    stack, count = [(window, 0)], 0
    while stack and count < MAX_NODES and not (cancel and cancel.is_set()):
        control, depth = stack.pop()
        count += 1
        yield control, depth
        if depth < MAX_DEPTH:
            try:
                children = control.GetChildren()
            except Exception:
                children = []
            stack.extend((child, depth + 1) for child in reversed(children))


def inspect(title: str | None = None, find: str | None = None, cancel=None) -> dict:
    auto = _uia()
    with auto.UIAutomationInitializerInThread():
        window = _window(title)
        if window is None:
            return {"status": "failed", "summary": "No such window is open"}
        if _protected(window):
            return PROTECTED
        _State.seq += 1
        obs_id = f"u{_State.seq}"
        refs, elements = {}, []
        for control, _depth in _walk(window, cancel):
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
        if cancel and cancel.is_set():
            return {"status": "failed", "summary": "Stopped before it finished", "stopped": True}
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


def gate_at(x: int | None, y: int | None, confirmed: bool, press: bool = False) -> dict | None:
    """
    The same hard rules for a click or keystrokes by coordinates: choosing the
    screen over a control must never be a way round them. What lies under the
    point (or has the keyboard, when x is None) and the controls holding it are
    read; a payment control is refused, a sensitive one asked about, a password
    field handed to the person. `press`: the keys include Enter or Space, which
    press the focused control as surely as a click does.
    """
    auto = _uia()  # missing or failing, the caller asks the person instead of clicking blind
    purchase, sensitive, _ = _gates()
    with auto.UIAutomationInitializerInThread():
        # Whole pixels: a desktop point is a float, and UI Automation refused one, which
        # the caller read as "unreadable" and let every coordinate click through.
        control = auto.GetFocusedControl() if x is None else auto.ControlFromPoint(round(x), round(y))
        if control is not None and _protected(control):
            return PROTECTED
        if x is None and control is not None and control.IsPassword:
            return {"status": "human_required",
                    "summary": "A password is needed. Take over and type it yourself."}
        if x is None and not press:
            return None
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
        purchase, sensitive, _ = _gates()
        if _protected(control):
            return PROTECTED
        if op in ("invoke", "toggle", "select") and purchase.search(name):
            return {"status": "blocked", "summary": "JARVIS never completes a purchase or payment"}
        if op in ("invoke", "toggle", "select") and sensitive.search(name) and not confirmed:
            return {"status": "needs_confirmation", "summary": f"Confirm before JARVIS presses “{name[:60]}”"}
        if control.IsPassword:
            return {"status": "human_required", "summary": "A password is needed. Take over and type it yourself."}
        if not control.IsEnabled:
            return {"status": "failed", "summary": f"“{name[:60]}” is disabled"}
        text = str(action.get("value", ""))[:20_000]
        # Asked by pattern id, not the typed getters: a CheckBoxControl has no
        # GetInvokePattern at all, though the app may still support it (a page
        # switch in a video editor is a check box). Unsupported is None.
        def pattern(kind: str):
            return control.GetPattern(getattr(auto.PatternId, kind))

        if op == "invoke":
            invoke = pattern("InvokePattern")
            toggle = None if invoke else pattern("TogglePattern")
            if invoke:
                invoke.Invoke()
            elif toggle:
                toggle.Toggle()
            else:
                control.Click(simulateMove=False)
        elif op == "set_value":
            value = pattern("ValuePattern")
            if not value or value.IsReadOnly:
                return {"status": "failed", "summary": f"“{name[:60]}” does not take text; type into it instead"}
            value.SetValue(text)
            if (_value(control) or "") != text:
                return {"status": "failed", "summary": "The field did not take the text"}
        elif op in ("toggle", "select", "expand", "collapse"):
            found = pattern({"toggle": "TogglePattern", "select": "SelectionItemPattern"}
                            .get(op, "ExpandCollapsePattern"))
            if not found:
                return {"status": "failed",
                        "summary": f"“{name[:60] or role}” cannot {op}; use invoke to press it"}
            {"toggle": lambda: found.Toggle(), "select": lambda: found.Select(),
             "expand": lambda: found.Expand(), "collapse": lambda: found.Collapse()}[op]()
        elif op == "focus":
            control.SetFocus()
        else:
            return {"status": "failed", "summary": "Unknown control operation"}
        time.sleep(0.4)
        title = window.Name
    after = inspect(title)
    return {"status": "done", "summary": f"{op.replace('_', ' ').capitalize()} “{name[:60] or role}”",
            "observation": after.get("observation")}
