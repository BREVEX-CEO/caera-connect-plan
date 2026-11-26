"""STOP fence: a modifier or mouse button an action left held is released, and nothing else.
Stand-ins for user32 and Quartz, so both platform paths run everywhere."""

import os
import sys
import unittest

from ocade_agent import held_input


class Recorder:
    def __init__(self, down):
        self.down, self.sent = set(down), []


class User32(Recorder):
    def GetAsyncKeyState(self, vk):
        return 0x8000 if vk in self.down else 0

    def keybd_event(self, vk, scan, flags, extra):
        self.sent.append(("key", vk, flags))

    def mouse_event(self, flags, x, y, data, extra):
        self.sent.append(("mouse", flags))


class Quartz(Recorder):
    kCGEventSourceStateCombinedSessionState, kCGHIDEventTap = 1, 0

    def CGEventSourceKeyState(self, state, code):
        return code in self.down

    def CGEventSourceButtonState(self, state, button):
        return ("button", button) in self.down

    def CGEventCreate(self, source):
        return "now"

    def CGEventGetLocation(self, event):
        return (10, 20)

    def CGEventCreateKeyboardEvent(self, source, code, down):
        return ("key", code, down)

    def CGEventCreateMouseEvent(self, source, kind, where, button):
        return ("mouse", kind, where, button)

    def CGEventPost(self, tap, event):
        self.sent.append(event)


class HeldInput(unittest.TestCase):
    def test_windows_releases_only_what_is_down(self):
        user32 = User32({0xA2, 0x01})  # left Ctrl and the left button
        self.assertEqual(held_input.release_windows(user32), ["LCtrl", "LeftButton"])
        self.assertEqual(user32.sent, [("key", 0xA2, 0x0002), ("mouse", 0x0004)])
        self.assertEqual(held_input.release_windows(User32(set())), [])

    def test_macos_releases_only_what_is_down(self):
        quartz = Quartz({55, ("button", 0)})  # Command and the left button
        self.assertEqual(held_input.release_mac(quartz), ["LCmd", "LeftButton"])
        self.assertEqual(quartz.sent, [("key", 55, False), ("mouse", 2, (10, 20), 0)])

    def test_release_never_raises(self):
        self.assertIsInstance(held_input.release_held(), list)


class X11Held(unittest.TestCase):
    """A real X server (Xvfb is enough): a modifier and a button held down are released, nothing else."""

    @unittest.skipUnless(sys.platform.startswith("linux") and os.environ.get("DISPLAY"), "needs an X11 display")
    def test_x11_releases_what_the_server_says_is_down(self):
        import ctypes
        import ctypes.util

        x11 = ctypes.CDLL(ctypes.util.find_library("X11") or "libX11.so.6")
        xtest = ctypes.CDLL(ctypes.util.find_library("Xtst") or "libXtst.so.6")
        x11.XOpenDisplay.restype = ctypes.c_void_p
        x11.XOpenDisplay.argtypes = [ctypes.c_char_p]
        x11.XKeysymToKeycode.restype = ctypes.c_ubyte
        x11.XKeysymToKeycode.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
        x11.XSync.argtypes = [ctypes.c_void_p, ctypes.c_int]
        x11.XQueryKeymap.argtypes = [ctypes.c_void_p, ctypes.c_char_p]
        xtest.XTestFakeKeyEvent.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_int, ctypes.c_ulong]
        xtest.XTestFakeButtonEvent.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_int, ctypes.c_ulong]
        display = x11.XOpenDisplay(None)
        self.assertTrue(display)
        control, shift = x11.XKeysymToKeycode(display, 0xFFE3), x11.XKeysymToKeycode(display, 0xFFE1)
        xtest.XTestFakeKeyEvent(display, control, True, 0)  # Ctrl is left down by a cut-off chord
        xtest.XTestFakeButtonEvent(display, 1, True, 0)  # and so is the left button
        x11.XSync(display, False)
        self.assertEqual(held_input.release_held(), ["LCtrl", "LeftButton"])
        x11.XSync(display, False)
        keymap = ctypes.create_string_buffer(32)
        x11.XQueryKeymap(display, keymap)
        for code in (control, shift):
            self.assertFalse(keymap.raw[code // 8] & (1 << (code % 8)))
        self.assertEqual(held_input.release_held(), [], "nothing else is released, and nothing is sent")


if __name__ == "__main__":
    unittest.main()
