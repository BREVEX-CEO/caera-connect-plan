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


if __name__ == "__main__":
    unittest.main()
