"""Plan v8 5.4: the Windows notification-area icon, on a real Windows desktop (a GitHub Windows
runner qualifies; it is not a customer PC). Its STOP is the local STOP file; closing removes it."""

import sys
import tempfile
import unittest
from pathlib import Path


@unittest.skipUnless(sys.platform == "win32", "needs a Windows desktop")
class WindowsTrayTest(unittest.TestCase):
    def test_the_icon_shows_its_stop_writes_the_local_stop_and_close_ends_it(self):
        import win32con  # type: ignore[import-not-found]
        import win32gui  # type: ignore[import-not-found]

        from ocade_agent.tray import STOP_ID, WindowsTray

        stop = Path(tempfile.mkdtemp()) / "STOP"
        tray = WindowsTray(stop, "https://ocade.example/ocade-jarvis")
        self.assertTrue(tray.start(), "the icon was shown")
        try:
            self.assertTrue(win32gui.IsWindow(tray.hwnd))
            win32gui.SendMessage(tray.hwnd, win32con.WM_COMMAND, STOP_ID, 0)
            self.assertTrue(stop.exists(), "the tray's STOP is the local STOP file")
        finally:
            tray.close()
        self.assertFalse(tray._thread.is_alive(), "the icon's thread ended")
        self.assertFalse(win32gui.IsWindow(tray.hwnd), "the icon's window is gone")


@unittest.skipUnless(sys.platform == "darwin", "needs a macOS desktop")
class MacMenuBarTest(unittest.TestCase):
    def test_the_menu_bar_item_shows_its_stop_writes_the_local_stop_and_close_ends_it(self):
        """Pressed through accessibility, as a person's click would be (a hosted macOS runner)."""
        import time

        from ApplicationServices import (  # type: ignore[import-not-found]
            AXUIElementCopyAttributeValue, AXUIElementCreateApplication, AXUIElementPerformAction,
        )

        from ocade_agent.tray import MacMenuBar

        def attribute(element, name):
            error, value = AXUIElementCopyAttributeValue(element, name, None)
            return value if error == 0 else None

        def stop_item(pid):
            bar = attribute(AXUIElementCreateApplication(pid), "AXExtrasMenuBar")
            for item in attribute(bar, "AXChildren") or [] if bar else []:
                AXUIElementPerformAction(item, "AXPress")
                for menu in attribute(item, "AXChildren") or []:
                    for entry in attribute(menu, "AXChildren") or []:
                        if attribute(entry, "AXTitle") == "STOP JARVIS now":
                            return entry
            return None

        stop = Path(tempfile.mkdtemp()) / "STOP"
        bar = MacMenuBar(stop, "https://ocade.example/ocade-jarvis")
        self.assertTrue(bar.start(), "the item was shown")
        try:
            deadline, entry = time.monotonic() + 10, None
            while entry is None and time.monotonic() < deadline:
                entry = stop_item(bar.process.pid)
                time.sleep(0.25)
            self.assertIsNotNone(entry, "the STOP entry is in the menu-bar item's menu")
            AXUIElementPerformAction(entry, "AXPress")
            deadline = time.monotonic() + 5
            while not stop.exists() and time.monotonic() < deadline:
                time.sleep(0.1)
            self.assertTrue(stop.exists(), "the menu bar's STOP is the local STOP file")
        finally:
            bar.close()
        self.assertIsNotNone(bar.process.poll(), "the item's process ended")


if __name__ == "__main__":
    unittest.main()
