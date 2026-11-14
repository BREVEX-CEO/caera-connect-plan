"""STOP fence: a modifier or mouse button an action left held is released, and nothing else.
Stand-ins for user32 and Quartz, so both platform paths run everywhere."""

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


if __name__ == "__main__":
    unittest.main()
