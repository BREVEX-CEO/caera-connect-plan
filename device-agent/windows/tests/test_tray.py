"""Plan v8 5.4: the Windows notification-area icon, on a real Windows desktop (a GitHub Windows
runner qualifies; it is not a customer PC). Its STOP is the local STOP file; closing removes it."""

import os
import sys
import tempfile
from unittest.mock import patch
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



class MacTrayProcessTest(unittest.TestCase):
    def test_mac_menu_helper_uses_the_existing_local_stop_and_parent_identity(self):
        from ocade_agent.tray import MacTray

        with tempfile.TemporaryDirectory() as folder:
            stop = Path(folder) / "STOP"
            with patch("subprocess.Popen") as launch, patch(
                "mcp.client.stdio.get_default_environment", return_value={"PATH": "/usr/bin"}
            ):
                launch.return_value.poll.return_value = None
                tray = MacTray(stop, "https://ocade.example/ocade-jarvis")
                self.assertTrue(tray.start())
                argv = launch.call_args.args[0]
                self.assertIn("tray", argv)
                self.assertIn("--tray-parent", argv)
                self.assertIn(str(os.getpid()), argv)
                self.assertEqual(launch.call_args.kwargs["env"]["OCADE_AGENT_HOME"], folder)
                self.assertNotIn("OCADE_DEVICE_KEY", launch.call_args.kwargs["env"])
                tray.close()
                launch.return_value.terminate.assert_called_once()
                launch.return_value.wait.assert_called_once_with(timeout=5)

    def test_menu_refuses_missing_or_unrelated_owner(self):
        from ocade_agent.tray import run_macos_status

        with tempfile.TemporaryDirectory() as folder:
            self.assertEqual(run_macos_status(Path(folder) / "STOP", None, os.getpid() + 100000), 3)
            self.assertFalse((Path(folder) / "STOP").exists())
