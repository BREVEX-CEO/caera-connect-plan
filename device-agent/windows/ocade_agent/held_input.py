"""Let go of keys and mouse buttons a cut-off action left held down (STOP fence).

A STOP or crash ends a worker between its key-down and key-up (a Ctrl+S chord, a pointer
click), and Windows or macOS then keeps that modifier or button down for every app until
something releases it: the person's next keystroke arrives as a shortcut. After the gateway
stops, the agent releases every modifier and mouse button that is still down, and only those
(the idea of openai-cua-sample-app's `release_inputs.py`, re-implemented with the platform's
own key-state calls). It sends no other input.
"""

from __future__ import annotations

import sys

# Windows virtual keys: Shift, Ctrl, Alt (either side), the Windows keys.
WINDOWS_KEYS = {0xA0: "LShift", 0xA1: "RShift", 0xA2: "LCtrl", 0xA3: "RCtrl", 0xA4: "LAlt", 0xA5: "RAlt",
                0x5B: "LWin", 0x5C: "RWin"}
# Windows buttons: virtual key -> mouse_event up flag.
WINDOWS_BUTTONS = {0x01: ("LeftButton", 0x0004), 0x02: ("RightButton", 0x0010), 0x04: ("MiddleButton", 0x0040)}
# macOS key codes (kVK_*): Command, Shift, Option, Control, each side.
MAC_KEYS = {55: "LCmd", 54: "RCmd", 56: "LShift", 60: "RShift", 58: "LOption", 61: "ROption", 59: "LCtrl",
            62: "RCtrl"}
# macOS buttons: CGMouseButton -> (name, CGEventType for its up event).
MAC_BUTTONS = {0: ("LeftButton", 2), 1: ("RightButton", 4), 2: ("MiddleButton", 26)}


def release_windows(user32) -> list[str]:
    released = []
    for vk, name in WINDOWS_KEYS.items():
        if user32.GetAsyncKeyState(vk) & 0x8000:
            user32.keybd_event(vk, 0, 0x0002, 0)  # KEYEVENTF_KEYUP
            released.append(name)
    for vk, (name, up) in WINDOWS_BUTTONS.items():
        if user32.GetAsyncKeyState(vk) & 0x8000:
            user32.mouse_event(up, 0, 0, 0, 0)
            released.append(name)
    return released


def release_mac(quartz) -> list[str]:
    state = quartz.kCGEventSourceStateCombinedSessionState
    released = []
    for code, name in MAC_KEYS.items():
        if quartz.CGEventSourceKeyState(state, code):
            quartz.CGEventPost(quartz.kCGHIDEventTap, quartz.CGEventCreateKeyboardEvent(None, code, False))
            released.append(name)
    where = quartz.CGEventGetLocation(quartz.CGEventCreate(None))
    for button, (name, up) in MAC_BUTTONS.items():
        if quartz.CGEventSourceButtonState(state, button):
            quartz.CGEventPost(quartz.kCGHIDEventTap, quartz.CGEventCreateMouseEvent(None, up, where, button))
            released.append(name)
    return released


# X11 keysyms: Shift, Control, Alt (either side), Super (either side); pointer buttons 1-3 and their masks.
X11_KEYS = {0xFFE1: "LShift", 0xFFE2: "RShift", 0xFFE3: "LCtrl", 0xFFE4: "RCtrl", 0xFFE9: "LAlt", 0xFFEA: "RAlt",
            0xFFEB: "LSuper", 0xFFEC: "RSuper"}
X11_BUTTONS = {1: ("LeftButton", 0x100), 2: ("MiddleButton", 0x200), 3: ("RightButton", 0x400)}


def release_x11(x11, xtest, display) -> list[str]:
    """Release the X11 modifiers and pointer buttons that are down (libX11 and libXtst, as ctypes
    libraries with their argument types set). Reads the server's own key and button state."""
    import ctypes

    keymap = ctypes.create_string_buffer(32)
    x11.XQueryKeymap(display, keymap)
    released = []
    for keysym, name in X11_KEYS.items():
        code = x11.XKeysymToKeycode(display, keysym)
        if code and keymap.raw[code // 8] & (1 << (code % 8)):
            xtest.XTestFakeKeyEvent(display, code, False, 0)
            released.append(name)
    root, child = ctypes.c_ulong(), ctypes.c_ulong()
    numbers = [ctypes.c_int() for _ in range(4)]
    mask = ctypes.c_uint()
    x11.XQueryPointer(display, x11.XDefaultRootWindow(display), ctypes.byref(root), ctypes.byref(child),
                      *(ctypes.byref(n) for n in numbers), ctypes.byref(mask))
    for button, (name, bit) in X11_BUTTONS.items():
        if mask.value & bit:
            xtest.XTestFakeButtonEvent(display, button, False, 0)
            released.append(name)
    if released:
        x11.XFlush(display)
    return released


def _release_x11_here() -> list[str]:
    import ctypes
    import ctypes.util
    import os

    if not os.environ.get("DISPLAY") or os.environ.get("XDG_SESSION_TYPE", "").lower() == "wayland":
        return []
    x11 = ctypes.CDLL(ctypes.util.find_library("X11") or "libX11.so.6")
    xtest = ctypes.CDLL(ctypes.util.find_library("Xtst") or "libXtst.so.6")
    x11.XOpenDisplay.restype = ctypes.c_void_p
    x11.XOpenDisplay.argtypes = [ctypes.c_char_p]
    x11.XDefaultRootWindow.restype = ctypes.c_ulong
    x11.XDefaultRootWindow.argtypes = [ctypes.c_void_p]
    x11.XKeysymToKeycode.restype = ctypes.c_ubyte
    x11.XKeysymToKeycode.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
    x11.XQueryKeymap.argtypes = [ctypes.c_void_p, ctypes.c_char_p]
    x11.XQueryPointer.argtypes = [ctypes.c_void_p, ctypes.c_ulong] + [ctypes.c_void_p] * 7
    x11.XFlush.argtypes = [ctypes.c_void_p]
    x11.XCloseDisplay.argtypes = [ctypes.c_void_p]
    xtest.XTestFakeKeyEvent.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_int, ctypes.c_ulong]
    xtest.XTestFakeButtonEvent.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_int, ctypes.c_ulong]
    display = x11.XOpenDisplay(None)
    if not display:
        return []
    try:
        return release_x11(x11, xtest, display)
    finally:
        x11.XCloseDisplay(display)


def release_held() -> list[str]:
    """Release what is held on this computer; the names released (none on other platforms).
    Never raises: a STOP must complete even where key state cannot be read."""
    try:
        if sys.platform == "win32":
            import ctypes

            return release_windows(ctypes.windll.user32)
        if sys.platform == "darwin":
            import Quartz  # type: ignore[import-not-found]

            return release_mac(Quartz)
        if sys.platform.startswith("linux"):
            return _release_x11_here()
    except Exception:
        pass
    return []
