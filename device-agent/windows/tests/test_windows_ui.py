"""UIA-001…010: the ui_bridge worker on a real Windows desktop, through the real gateway.

The target is an app this test compiles on the spot under a random name, so nothing
about it can be known in advance by the product: it is found through the same App
Paths discovery a customer's app would be. Effects are checked independently (the
file the app writes, Win32 window state), never by the worker's own word.
Runs only on Windows with an interactive desktop (a GitHub `windows-latest` runner
qualifies; it is not a customer PC and says nothing about other apps or DPI setups).
"""

import os
import secrets
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

import anyio

from ocade_agent.gateway import Gateway
from tests.test_gateway import intent

APP = r"""
using System; using System.IO; using System.Windows.Forms;
class Note : Form {
  [STAThread] static void Main(string[] a) { Application.Run(new Note(a.Length > 0 ? a[0] : "note.txt")); }
  Note(string path) {
    Text = "Ledger Note"; Width = 420; Height = 220;
    var box = new TextBox { Name = "noteBox", AccessibleName = "Note", Left = 20, Top = 20, Width = 360 };
    var save = new Button { Name = "saveButton", Text = "Save", Left = 20, Top = 60, Width = 120, Height = 40 };
    save.Click += (s, e) => File.WriteAllText(path, box.Text);
    Controls.Add(box); Controls.Add(save);
  }
}
"""


class EnvironmentContract(unittest.TestCase):
    def test_workers_receive_windows_system_folders(self):
        """App discovery reads the all-users Start Menu: the worker must see PROGRAMDATA."""
        with patch.dict(os.environ, {"PROGRAMDATA": r"C:\ProgramData", "OCADE_SECRET_TOKEN": "x"}):
            env = Gateway("sandbox")._parameters("ocade_agent.windows_worker").env
        self.assertEqual(env["PROGRAMDATA"], r"C:\ProgramData")
        self.assertNotIn("OCADE_SECRET_TOKEN", env)


@unittest.skipUnless(sys.platform == "win32", "needs a Windows desktop")
class WindowsUiLadder(unittest.TestCase):
    def setUp(self):
        import winreg

        self.root = Path(tempfile.mkdtemp())
        self.exe = f"ocade-fixture-{secrets.token_hex(4)}.exe"
        built = Path(tempfile.mkdtemp()) / self.exe
        source = built.with_suffix(".cs")
        source.write_text(APP)
        csc = Path(os.environ["WINDIR"]) / "Microsoft.NET/Framework64/v4.0.30319/csc.exe"
        subprocess.run([str(csc), "/nologo", "/target:winexe", f"/out:{built}", str(source)], check=True)
        self.key = rf"Software\Microsoft\Windows\CurrentVersion\App Paths\{self.exe}"
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, self.key) as key:
            winreg.SetValue(key, None, winreg.REG_SZ, str(built))
        (self.root / "note.txt").write_text("")
        # A person's resting mouse, away from the fail-safe corners.
        import win32api  # type: ignore[import-not-found]

        win32api.SetCursorPos((300, 300))

    def tearDown(self):
        import winreg

        subprocess.run(["taskkill", "/F", "/IM", self.exe], capture_output=True)
        winreg.DeleteKey(winreg.HKEY_CURRENT_USER, self.key)

    def note(self) -> str:
        return (self.root / "note.txt").read_text()

    def test_ui_ladder(self):
        import win32con  # type: ignore[import-not-found]
        import win32gui  # type: ignore[import-not-found]

        async def steps():
            out = {}
            async with Gateway(str(self.root)) as gateway:
                def run(op, args):
                    return gateway.run(intent(op, args), gateway.epoch)

                out["list"] = await run("apps.list", {})
                out["unknown"] = await run("apps.launch", {"exe": "not-installed-anywhere.exe"})
                out["launch"] = await run("apps.launch", {"exe": self.exe, "open": "note.txt"})
                window = out["launch"]["evidence"]["window"]
                out["inspect"] = await run("ui.inspect", {"window": window})
                box = {"automationId": "noteBox"}
                out["set"] = await run("ui.set_value", {"window": window, "element": box, "value": "Quarterly GREEN"})
                out["invoke"] = await run("ui.invoke", {"window": window, "element": {"name": "Save", "controlType": "Button"}})
                out["after_invoke"] = self.note()
                out["keys"] = await run("ui.send_keys", {"window": window, "keys": "{END}+{HOME}{BACKSPACE}typed by keys", "element": box})
                await run("ui.invoke", {"window": window, "element": {"automationId": "saveButton"}})
                out["after_keys"] = self.note()
                # The person presses a key: JARVIS's hands pause, then continue once they are quiet.
                import win32api  # type: ignore[import-not-found]

                time.sleep(1)  # input within 250 ms of JARVIS's own cannot be told apart
                win32api.keybd_event(win32con.VK_SHIFT, 0, 0, 0)
                win32api.keybd_event(win32con.VK_SHIFT, 0, win32con.KEYEVENTF_KEYUP, 0)
                out["person"] = await run("ui.set_value", {"window": window, "element": box, "value": "too soon"})
                time.sleep(2)
                out["quiet"] = await run("ui.set_value", {"window": window, "element": box, "value": "after quiet"})
                out["forged"] = await run("ui.inspect", {"window": window | {"pid": window["pid"] + 4}})
                out["ambiguous"] = await run("ui.invoke", {"window": window, "element": {}})

                # Last-resort click, after the person resized and moved the window.
                hwnd = window["hwnd"]
                win32gui.MoveWindow(hwnd, 120, 90, 520, 260, True)
                time.sleep(0.5)
                await run("ui.set_value", {"window": window, "element": box, "value": "saved by click"})
                # The model's eyes: the box ui.inspect reports for the button, after the move.
                out["moved"] = await run("ui.inspect", {"window": window})
                x0, y0, x1, y1 = next(e["box"] for e in out["moved"]["evidence"]["elements"]
                                      if e["automationId"] == "saveButton")
                point = {"x": (x0 + x1) / 2, "y": (y0 + y1) / 2}
                out["wrong_title"] = await run("ui.click_point", {"window": window, **point, "expectTitle": "Other app"})
                out["click"] = await run("ui.click_point", {"window": window, **point, "expectTitle": "Ledger Note"})
                time.sleep(0.5)
                out["after_click"] = self.note()

                win32gui.ShowWindow(hwnd, win32con.SW_MINIMIZE)
                time.sleep(0.5)
                out["minimized"] = await run("ui.set_value", {"window": window, "element": box, "value": "x"})
                win32gui.PostMessage(hwnd, win32con.WM_CLOSE, 0, 0)
                time.sleep(1)
                out["closed"] = await run("ui.inspect", {"window": window})
            return out

        out = anyio.run(steps)

        with self.subTest("UIA-001 an unseen installed app is discovered"):
            self.assertIn(self.exe, [a["exe"] for a in out["list"]["evidence"]["installed"]])
        with self.subTest("UIA-002 an app that is not installed is refused, nothing launched"):
            self.assertEqual(out["unknown"]["errorCode"], "app_not_installed")
        with self.subTest("UIA-003 launch leases the new window with its process identity"):
            self.assertEqual(out["launch"]["status"], "observed", out["launch"])
            self.assertEqual(out["launch"]["evidence"]["window"]["exe"], self.exe)
        with self.subTest("UIA-004 inspect lists accessible controls"):
            ids = {e["automationId"] for e in out["inspect"]["evidence"]["elements"]}
            self.assertTrue({"noteBox", "saveButton"} <= ids, ids)
            self.assertTrue(out["inspect"].get("preview"), "the window is seen, not only listed")
        with self.subTest("UIA-005 set value reads back; invoke has the app's real effect"):
            self.assertTrue(out["set"]["evidence"]["matches"], out["set"])
            self.assertEqual(out["invoke"]["status"], "observed", out["invoke"])
            self.assertEqual(out["after_invoke"], "Quarterly GREEN")
        with self.subTest("UIA-006 keys go to the leased foreground window"):
            self.assertEqual(out["keys"]["status"], "observed", out["keys"])
            self.assertEqual(out["after_keys"], "typed by keys")
        with self.subTest("UIA-012 a person's keyboard input pauses mutations until they are quiet"):
            self.assertEqual(out["person"]["errorCode"], "user_active")
            self.assertTrue(out["quiet"]["evidence"]["matches"], out["quiet"])
        with self.subTest("UIA-007 a forged lease is refused"):
            self.assertEqual(out["forged"]["errorCode"], "window_changed")
        with self.subTest("UIA-008 a click on an unexpected window is refused; after resize a click at the inspected box lands"):
            self.assertEqual(out["wrong_title"]["errorCode"], "unexpected_window")
            self.assertEqual(out["click"]["status"], "observed", out["click"])
            self.assertEqual(out["after_click"], "saved by click")
        with self.subTest("UIA-009 a minimized window is not acted on"):
            self.assertEqual(out["minimized"]["errorCode"], "window_minimized")
        with self.subTest("UIA-010 a closed window is gone, not re-targeted"):
            self.assertEqual(out["closed"]["errorCode"], "window_gone")
        with self.subTest("UIA-011 an empty element description is ambiguous, not guessed"):
            self.assertEqual(out["ambiguous"]["errorCode"], "element_ambiguous")


if __name__ == "__main__":
    unittest.main()
