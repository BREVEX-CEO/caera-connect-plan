"""SKILLFORGE: what the person shows once, in one window, as ordered steps (plan 28.2.1, X01).

`ui.record` watches ONE leased window, for a bounded time the person chose, while the person
works in it: a press of the left mouse button inside the window names the control under the
pointer (through accessibility, never a screenshot), and the window's text values are compared
twice a second. The result is a list of steps, never an action:

- `invoke`: a button, menu item, link, tab, check box or list item the person pressed;
- `set_value`: the final text the person left in a field (several edits of one field are one step);
- `secret`: a protected (password) field the person pressed into. Its value is NEVER read or
  recorded; a skill made from the recording asks for it every time it runs.

Nothing outside the leased window is recorded (a press elsewhere is ignored), nothing is typed or
clicked by OCADE, and STOP ends the recording like any other step. The website turns the steps
into an editable proposal; saving it as a skill is the person's own step.
"""

from __future__ import annotations

import time

PRESSABLE = {
    "Button", "MenuItem", "Hyperlink", "CheckBox", "RadioButton", "TabItem", "ListItem", "TreeItem",
    "SplitButton", "AXButton", "AXMenuItem", "AXLink", "AXCheckBox", "AXRadioButton", "AXTab",
    "AXRow", "AXCell", "AXPopUpButton", "AXMenuButton",
}
MAX_STEPS = 40
MAX_SECONDS = 120


def selector(element: dict) -> dict | None:
    """How a replay finds the control again: its automation id, else its name and type."""
    if element.get("protected"):
        return None
    if element.get("automationId"):
        return {"automationId": element["automationId"][:200]}
    if element.get("name"):
        return {"name": element["name"][:200], "controlType": str(element.get("controlType", ""))[:40]}
    return None


def _key(element: dict) -> str:
    return element.get("automationId") or f'{element.get("controlType")}:{element.get("name")}'


class Demonstration:
    def __init__(self, elements: list[dict]) -> None:
        self.steps: list[dict] = []
        self._values = {_key(e): e.get("value") for e in elements if "value" in e}
        self._secrets: set[str] = set()

    def _add(self, step: dict) -> None:
        if len(self.steps) < MAX_STEPS:
            self.steps.append(step)

    def pressed(self, element: dict | None) -> None:
        if element and element.get("protected"):
            if _key(element) not in self._secrets:
                self._secrets.add(_key(element))
                self._add({"kind": "secret", "label": "Protected text field"})
            return
        if not element or element.get("controlType") not in PRESSABLE:
            return  # a press into a text box only focuses it; its value is recorded below
        found = selector(element)
        if found:
            self._add({"kind": "invoke", "element": found, "label": element.get("name", "")[:120]})

    def values(self, elements: list[dict]) -> None:
        for element in elements:
            key = _key(element)
            if element.get("protected") or "value" not in element or self._values.get(key) == element["value"]:
                continue
            self._values[key] = element["value"]
            found = selector(element)
            if not found:
                continue
            last = self.steps[-1] if self.steps else None
            if last and last["kind"] == "set_value" and last["element"] == found:
                last["value"] = element["value"]
            else:
                self._add({"kind": "set_value", "element": found, "value": element["value"],
                           "label": element.get("name", "")[:120]})


def record(seconds: int, button_down, pointer, element_at, inside, snapshot, alive,
           now=time.monotonic, sleep=time.sleep) -> dict:
    """Run one bounded recording. Each argument is the desktop's own probe (see the workers)."""
    seconds = max(5, min(MAX_SECONDS, int(seconds)))
    demo = Demonstration(snapshot())
    started, last_values, was_down = now(), now(), False
    while now() - started < seconds and len(demo.steps) < MAX_STEPS:
        if not alive():
            break
        down = button_down()
        if was_down and not down:  # a completed press
            x, y = pointer()
            if inside(x, y):
                demo.values(snapshot())  # what was typed before the press comes first
                demo.pressed(element_at(x, y))
        was_down = down
        if now() - last_values >= 0.5:
            demo.values(snapshot())
            last_values = now()
        sleep(0.05)
    demo.values(snapshot())
    return {"steps": demo.steps, "recordedSeconds": round(now() - started, 1), "complete": alive()}
