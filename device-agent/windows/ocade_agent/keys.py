"""One keyboard contract for every desktop (`ui.send_keys`).

`keys` is a list of items, each either `{"text": ...}` (typed exactly as written, whatever
characters it holds) or `{"press": ...}` (one key, optionally with modifiers: `Enter`,
`Shift+Tab`, `Mod+S`). `Mod` is the platform's main shortcut key: Ctrl on Windows, Cmd on
macOS. The same list means the same thing on both platforms, so the planner never has to
know a platform's input syntax and typed text can never be read as a command.

Pure translation only: nothing here sends input. Each bridge posts what its translator
returns, after its own lease, focus and person-activity checks.
"""

from __future__ import annotations

from .sandbox import Refused

MODIFIERS = ("Mod", "Ctrl", "Alt", "Shift", "Cmd")
# name -> (pywinauto code, macOS virtual key code; Carbon HIToolbox kVK_* values)
NAMED = {
    "Enter": ("{ENTER}", 0x24), "Tab": ("{TAB}", 0x30), "Escape": ("{ESC}", 0x35),
    "Backspace": ("{BACKSPACE}", 0x33), "Delete": ("{DELETE}", 0x75), "Space": ("{SPACE}", 0x31),
    "Home": ("{HOME}", 0x73), "End": ("{END}", 0x77), "PageUp": ("{PGUP}", 0x74),
    "PageDown": ("{PGDN}", 0x79), "Up": ("{UP}", 0x7E), "Down": ("{DOWN}", 0x7D),
    "Left": ("{LEFT}", 0x7B), "Right": ("{RIGHT}", 0x7C), "Insert": ("{INSERT}", 0x72),
    "F1": ("{F1}", 0x7A), "F2": ("{F2}", 0x78), "F3": ("{F3}", 0x63), "F4": ("{F4}", 0x76),
    "F5": ("{F5}", 0x60), "F6": ("{F6}", 0x61), "F7": ("{F7}", 0x62), "F8": ("{F8}", 0x64),
    "F9": ("{F9}", 0x65), "F10": ("{F10}", 0x6D), "F11": ("{F11}", 0x67), "F12": ("{F12}", 0x6F),
}
# ponytail: letter and digit key codes are the US (ANSI) positions; an app on another layout may
# read a shortcut's letter differently. Resolve through the current layout if that is ever seen.
_MAC_CHARACTERS = {
    "a": 0x00, "s": 0x01, "d": 0x02, "f": 0x03, "h": 0x04, "g": 0x05, "z": 0x06, "x": 0x07, "c": 0x08,
    "v": 0x09, "b": 0x0B, "q": 0x0C, "w": 0x0D, "e": 0x0E, "r": 0x0F, "y": 0x10, "t": 0x11, "1": 0x12,
    "2": 0x13, "3": 0x14, "4": 0x15, "6": 0x16, "5": 0x17, "9": 0x19, "7": 0x1A, "8": 0x1C, "0": 0x1D,
    "o": 0x1F, "u": 0x20, "i": 0x22, "p": 0x23, "l": 0x25, "j": 0x26, "k": 0x28, "n": 0x2D, "m": 0x2E,
}
_WINDOWS_MODIFIERS = {"Mod": "^", "Ctrl": "^", "Alt": "%", "Shift": "+"}
_MAC_MODIFIERS = {"Mod": "command", "Cmd": "command", "Ctrl": "control", "Alt": "option", "Shift": "shift"}


def _items(keys) -> list[tuple[str, str]]:
    """[("text" | "press", value)] for a well-formed list, else a refusal: nothing is guessed."""
    if not isinstance(keys, list) or not 1 <= len(keys) <= 20:
        raise Refused("keys_invalid")
    items = []
    for item in keys:
        if not isinstance(item, dict) or len(item) != 1:
            raise Refused("keys_invalid")
        (kind, value), = item.items()
        if kind not in ("text", "press") or not isinstance(value, str) or not value:
            raise Refused("keys_invalid")
        if kind == "text" and any(ord(character) < 32 or ord(character) == 127 for character in value):
            raise Refused("keys_invalid")  # a control character is a key press, never text
        items.append((kind, value))
    return items


def _press(press: str) -> tuple[list[str], str]:
    """(modifiers, key) of one press, e.g. "Mod+Shift+S" -> (["Mod", "Shift"], "S")."""
    *modifiers, key = press.split("+")
    if (len(set(modifiers)) != len(modifiers) or any(m not in MODIFIERS for m in modifiers)
            or not (key in NAMED or (len(key) == 1 and key.isascii() and key.isalnum()))):
        raise Refused("key_unsupported")
    return modifiers, key


def windows_sequence(keys) -> str:
    """The pywinauto `send_keys` string for a key list (send with `with_spaces=True`)."""
    out = []
    for kind, value in _items(keys):
        if kind == "text":
            # pywinauto reads + ^ % ~ ( ) { } as commands: braces make each one a typed character.
            out.append("".join("{" + c + "}" if c in "+^%~(){}" else c for c in value))
            continue
        modifiers, key = _press(value)
        if "Cmd" in modifiers:
            raise Refused("key_unsupported")  # no such key here; Mod is the portable shortcut key
        prefix = "".join(dict.fromkeys(_WINDOWS_MODIFIERS[m] for m in modifiers))
        out.append(prefix + (NAMED[key][0] if key in NAMED else key.lower()))
    return "".join(out)


def mac_events(keys) -> list[tuple]:
    """[("text", string) | ("key", virtual key code, [modifier names])] for a key list."""
    out: list[tuple] = []
    for kind, value in _items(keys):
        if kind == "text":
            out.append(("text", value))
            continue
        modifiers, key = _press(value)
        code = NAMED[key][1] if key in NAMED else _MAC_CHARACTERS[key.lower()]
        out.append(("key", code, list(dict.fromkeys(_MAC_MODIFIERS[m] for m in modifiers))))
    return out
