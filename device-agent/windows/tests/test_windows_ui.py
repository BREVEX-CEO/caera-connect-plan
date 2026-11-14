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
    // F2 asks a modal question, as many apps do (a first-run welcome, a save-format choice).
    KeyPreview = true;
    KeyDown += (s, e) => { if (e.KeyCode == Keys.F2) BeginInvoke((Action)(() => MessageBox.Show(this, "Keep the note?", "Ledger Question"))); };
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


    def test_the_desktop_bridge_is_reported_only_where_it_works(self):
        from ocade_agent import discovery

        works = sys.platform == "win32"
        if sys.platform == "darwin":  # only once the person has granted Accessibility
            import ApplicationServices

            works = bool(ApplicationServices.AXIsProcessTrusted())
        self.assertEqual("desktop" in discovery.engines(), works)


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
                out["region"] = await run("ui.inspect", {"window": window, "region": [0, 0, 0.5, 0.5]})
                box = {"automationId": "noteBox"}
                out["set"] = await run("ui.set_value", {"window": window, "element": box, "value": "Quarterly GREEN"})
                # A second look lists only what changed (C5); every other ref stays as it was.
                out["changes"] = await run("ui.inspect", {"window": window, "changesOnly": True})
                out["present"] = await run("ui.wait", {"window": window, "element": {"automationId": "saveButton"}})
                out["never"] = await run("ui.wait", {"window": window, "element": {"automationId": "neverThere"},
                                                     "timeoutMs": 400})
                # By the ref the newest inspection gave the button (P5), not by a description.
                save = next(e["ref"] for e in out["region"]["evidence"]["elements"] if e["automationId"] == "saveButton")
                out["invoke"] = await run("ui.invoke", {"window": window, "element": {"ref": save}})
                out["after_invoke"] = self.note()
                out["keys"] = await run("ui.send_keys", {"window": window, "element": box, "keys": [
                    {"press": "End"}, {"press": "Shift+Home"}, {"press": "Backspace"}, {"text": "100% (a+b) ~{typed}^ by keyz"},
                    {"press": "Backspace"}, {"text": "s"}]})
                await run("ui.invoke", {"window": window, "element": {"automationId": "saveButton"}})
                out["after_keys"] = self.note()
                # The app asks a modal question: it is answered as its own window, never typed past.
                out["ask"] = await run("ui.send_keys", {"window": window, "element": box, "keys": [{"press": "F2"}]})
                time.sleep(1)
                out["blocked_keys"] = await run("ui.send_keys", {"window": window, "keys": [{"text": "lost"}]})
                out["blocked_set"] = await run("ui.set_value", {"window": window, "element": box, "value": "lost"})
                listed = await run("apps.list", {})
                out["dialog"] = next((w for w in listed["evidence"]["windows"]
                                      if w["pid"] == window["pid"] and w["hwnd"] != window["hwnd"]), None)
                if out["dialog"]:
                    lease = {key: out["dialog"][key] for key in ("exe", "pid", "hwnd", "started")}
                    out["dialog_ok"] = await run("ui.wait", {"window": lease, "element": {"name": "OK"}})
                    out["answer"] = await run("ui.send_keys", {"window": lease, "keys": [{"press": "Enter"}]})
                    out["dialog_gone"] = await run("ui.wait", {"window": lease, "element": {"name": "OK"}, "gone": True})
                time.sleep(1)
                out["after_dialog"] = await run("ui.set_value", {"window": window, "element": box, "value": "after dialog"})
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
                # Resized again since the image the point came from: the click is refused, nothing done.
                win32gui.MoveWindow(hwnd, 120, 90, 600, 300, True)
                time.sleep(0.5)
                out["stale"] = await run("ui.click_point", {"window": window, **point, "expectTitle": "Ledger Note"})

                # The app stops responding (its process suspended): nothing is attempted on it.
                import ctypes

                handle = ctypes.windll.kernel32.OpenProcess(0x0800, False, window["pid"])  # PROCESS_SUSPEND_RESUME
                ctypes.windll.ntdll.NtSuspendProcess(handle)
                try:
                    time.sleep(6)  # Windows calls a window hung after 5 s without messages
                    out["hung"] = await run("ui.set_value", {"window": window, "element": box, "value": "x"})
                finally:
                    ctypes.windll.ntdll.NtResumeProcess(handle)
                    ctypes.windll.kernel32.CloseHandle(handle)
                time.sleep(1)

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
            self.assertTrue(out["region"].get("preview"), out["region"])
            self.assertEqual(out["region"]["evidence"]["previewRegion"], [0, 0, 0.5, 0.5])
        with self.subTest("UIA-005 set value reads back; invoke has the app's real effect"):
            self.assertTrue(out["set"]["evidence"]["matches"], out["set"])
            self.assertEqual(out["invoke"]["status"], "observed", out["invoke"])
            self.assertEqual(out["after_invoke"], "Quarterly GREEN")
        with self.subTest("UIA-018 a second look lists only what changed, and unchanged refs stay valid (C5)"):
            first = {e["automationId"]: e["ref"] for e in out["inspect"]["evidence"]["elements"]}
            again = {e["automationId"]: e["ref"] for e in out["region"]["evidence"]["elements"]}
            self.assertEqual(first["saveButton"], again["saveButton"], "a unique control keeps its ref")
            changed = {e["automationId"]: e for e in out["changes"]["evidence"]["elements"]}
            self.assertEqual(changed["noteBox"].get("value"), "Quarterly GREEN", out["changes"])
            self.assertNotIn("saveButton", changed, out["changes"])
            self.assertGreater(out["changes"]["evidence"]["unchanged"], 0, out["changes"])
        with self.subTest("UIA-019 ui.wait returns once a control is there and refuses when it never comes (C6)"):
            self.assertEqual(out["present"]["status"], "observed", out["present"])
            self.assertTrue(out["present"]["evidence"]["met"], out["present"])
            self.assertEqual((out["never"]["status"], out["never"]["errorCode"], out["never"]["maybeChanged"]),
                             ("not_applied", "wait_timed_out", False), out["never"])
            self.assertTrue(out["dialog_ok"]["evidence"]["met"], out["dialog_ok"])
            self.assertTrue(out["dialog_gone"]["evidence"]["met"], out["dialog_gone"])
        with self.subTest("UIA-006 keys go to the leased foreground window"):
            self.assertEqual(out["keys"]["status"], "observed", out["keys"])
            # Text with every character a keyboard library reads as a command arrives as written.
            self.assertEqual(out["after_keys"], "100% (a+b) ~{typed}^ by keys")
        with self.subTest("UIA-017 a modal dialog of the app is answered first; nothing is typed past it"):
            self.assertEqual(out["ask"]["status"], "observed", out["ask"])
            self.assertEqual((out["blocked_keys"]["status"], out["blocked_keys"]["errorCode"]), ("not_applied", "window_blocked"))
            self.assertFalse(out["blocked_keys"]["maybeChanged"], out["blocked_keys"])
            self.assertEqual((out["blocked_set"]["status"], out["blocked_set"]["errorCode"], out["blocked_set"]["maybeChanged"]),
                             ("not_applied", "window_blocked", False))
            self.assertEqual(out["dialog"]["title"], "Ledger Question", out["dialog"])
            # The refusal itself names the dialog with its exact lease (P5): no app listing needed.
            lease = {key: out["dialog"][key] for key in ("exe", "pid", "hwnd", "started")}
            self.assertIn(lease, [{key: w[key] for key in lease} for w in out["blocked_keys"]["evidence"].get("dialogs", [])],
                          out["blocked_keys"])
            self.assertEqual(out["answer"]["status"], "observed", out["answer"])
            self.assertTrue(out["after_dialog"]["evidence"]["matches"], out["after_dialog"])
        with self.subTest("UIA-012 a person's keyboard input pauses mutations until they are quiet"):
            self.assertEqual(out["person"]["errorCode"], "user_active")
            self.assertTrue(out["quiet"]["evidence"]["matches"], out["quiet"])
        with self.subTest("UIA-007 a forged lease is refused"):
            self.assertEqual(out["forged"]["errorCode"], "window_changed")
        with self.subTest("UIA-008 a click on an unexpected window is refused; after resize a click at the inspected box lands"):
            self.assertEqual(out["wrong_title"]["errorCode"], "unexpected_window")
            self.assertEqual(out["click"]["status"], "observed", out["click"])
            self.assertGreaterEqual(out["click"]["evidence"]["confidence"], 0.9)
        with self.subTest("UIA-014 a window that stopped responding is refused, nothing attempted"):
            self.assertEqual((out["hung"]["status"], out["hung"]["errorCode"]), ("not_applied", "window_not_responding"))
            self.assertFalse(out["hung"]["maybeChanged"], out["hung"])
        with self.subTest("UIA-013 a click grounded in a stale image of a resized window is refused, nothing clicked"):
            self.assertEqual((out["stale"]["status"], out["stale"]["maybeChanged"], out["stale"]["errorCode"]),
                             ("not_applied", False, "window_resized"))
            self.assertEqual(out["after_click"], "saved by click")
        with self.subTest("UIA-009 a minimized window is not acted on"):
            self.assertEqual(out["minimized"]["errorCode"], "window_minimized")
        with self.subTest("UIA-010 a closed window is gone, not re-targeted"):
            self.assertEqual(out["closed"]["errorCode"], "window_gone")
        with self.subTest("UIA-011 an empty element description is ambiguous, not guessed"):
            self.assertEqual(out["ambiguous"]["errorCode"], "element_ambiguous")


LAUNCHER = r"""
using System; using System.Diagnostics; using System.IO; using System.Reflection;
class Launch {
  static void Main(string[] a) {
    var here = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
    var info = new ProcessStartInfo(Path.Combine(here, "PROGRAM"), a.Length > 0 ? "\"" + a[0] + "\"" : "");
    info.UseShellExecute = false;
    var started = Process.Start(info);
    if (STAYS) started.WaitForExit();
  }
}
"""


@unittest.skipUnless(sys.platform == "win32", "needs a Windows desktop")
class WindowsLauncherApps(unittest.TestCase):
    """UIA-015/016: an app known only by its Start Menu shortcut, whose shortcut starts a small
    launcher while another program in the same folder owns the window (as many real apps do).
    Everything is compiled here under random names; nothing about it is known to the product."""

    def setUp(self):
        import win32com.client  # type: ignore[import-not-found]

        self.root = Path(tempfile.mkdtemp())
        (self.root / "note.txt").write_text("")
        folder = Path(tempfile.mkdtemp())
        tag = secrets.token_hex(4)
        self.program = f"ocade-fixture-{tag}.bin"
        self.launchers = {"stays": f"ocade-stays-{tag}.exe", "exits": f"ocade-exits-{tag}.exe"}
        csc = Path(os.environ["WINDIR"]) / "Microsoft.NET/Framework64/v4.0.30319/csc.exe"

        def build(name: str, source: str) -> Path:
            code = folder / (name + ".cs")
            code.write_text(source)
            subprocess.run([str(csc), "/nologo", "/target:winexe", f"/out:{folder / name}", str(code)], check=True)
            return folder / name

        build(self.program, APP)
        menu = Path(os.environ["APPDATA"]) / "Microsoft/Windows/Start Menu/Programs"
        shell = win32com.client.Dispatch("WScript.Shell")
        self.links = []
        for kind, name in self.launchers.items():
            built = build(name, LAUNCHER.replace("PROGRAM", self.program).replace("STAYS", "true" if kind == "stays" else "false"))
            link = menu / f"OCADE fixture {kind} {tag}.lnk"
            shortcut = shell.CreateShortCut(str(link))
            shortcut.TargetPath = str(built)
            shortcut.Save()
            self.links.append(link)
        import win32api  # type: ignore[import-not-found]

        win32api.SetCursorPos((300, 300))

    def tearDown(self):
        for image in (self.program, *self.launchers.values()):
            subprocess.run(["taskkill", "/F", "/IM", image], capture_output=True)
        # Explorer reads a new Start Menu shortcut for a moment after it appears and holds it
        # open without delete sharing; the fixture's own shortcut is removed once it lets go.
        deadline = time.monotonic() + 30
        for link in self.links:
            while True:
                try:
                    link.unlink(missing_ok=True)
                    break
                except PermissionError:
                    if time.monotonic() > deadline:
                        raise
                    time.sleep(0.5)

    def launched(self, kind: str) -> dict:
        async def steps():
            out = {}
            async with Gateway(str(self.root)) as gateway:
                def run(op, args):
                    return gateway.run(intent(op, args), gateway.epoch)

                out["list"] = await run("apps.list", {})
                out["launch"] = await run("apps.launch", {"exe": self.launchers[kind], "open": "note.txt"})
                if out["launch"]["status"] == "observed":
                    window = out["launch"]["evidence"]["window"]
                    out["inspect"] = await run("ui.inspect", {"window": window})
                    out["listed"] = await run("apps.list", {})
                    out["set"] = await run("ui.set_value", {"window": window, "element": {"automationId": "noteBox"}, "value": "through the launcher"})
                    await run("ui.invoke", {"window": window, "element": {"automationId": "saveButton"}})
            return out

        return anyio.run(steps)

    def check(self, kind: str, expected_exe: str):
        out = self.launched(kind)
        with self.subTest("an app with only a Start Menu shortcut is discovered and launched from it"):
            self.assertIn(self.launchers[kind], [a["exe"] for a in out["list"]["evidence"]["installed"]])
            self.assertEqual(out["launch"]["status"], "observed", out["launch"])
        window = out["launch"]["evidence"]["window"]
        with self.subTest("the window another program in the folder owns is leased under the app's name"):
            self.assertEqual(window["exe"], expected_exe)
            listed = [w for w in out["listed"]["evidence"]["windows"] if w["hwnd"] == window["hwnd"]]
            self.assertEqual([w["exe"] for w in listed], [expected_exe], "apps.list names it the same way")
        with self.subTest("that lease works: the window is inspected and changed, with the app's real effect"):
            ids = {e["automationId"] for e in out["inspect"]["evidence"]["elements"]}
            self.assertTrue({"noteBox", "saveButton"} <= ids, out["inspect"])
            self.assertTrue(out["set"]["evidence"]["matches"], out["set"])
            self.assertEqual((self.root / "note.txt").read_text(), "through the launcher")

    def test_a_launcher_that_stays_names_its_programs_windows(self):
        # UIA-015: the launcher is still the window's parent, so the window is the launcher's app.
        self.check("stays", self.launchers["stays"])

    def test_a_launcher_that_exits_leaves_the_program_its_own_name(self):
        # UIA-016: nothing ties the window to the launcher any more; it keeps its program's name.
        self.check("exits", self.program)


@unittest.skipUnless(sys.platform == "win32", "needs a Windows desktop")
class WindowListing(unittest.TestCase):
    def test_an_untitled_dialog_is_listed_and_other_untitled_windows_are_not(self):
        """A save-format question often has no title (desktop probe, LibreOffice on Windows):
        it was never listed, so a window it blocked could never be answered."""
        import win32con  # type: ignore[import-not-found]

        from ocade_agent import discovery

        windows = {  # hwnd: (title, owner, extended style)
            1: ("budget.xlsx", 0, 0),
            2: ("", 1, 0),  # an owned, untitled dialog
            3: ("", 0, 0),  # an untitled top-level window: not an app window
            4: ("", 1, win32con.WS_EX_TOOLWINDOW),  # an owned tool window (a tooltip)
        }
        with patch("win32gui.EnumWindows", lambda visit, extra: [visit(hwnd, extra) for hwnd in windows]), patch(
            "win32gui.IsWindowVisible", return_value=True
        ), patch("win32gui.GetWindowText", side_effect=lambda hwnd: windows[hwnd][0]), patch(
            "win32gui.GetWindow", side_effect=lambda hwnd, kind: windows[hwnd][1]
        ), patch("win32gui.GetWindowLong", side_effect=lambda hwnd, kind: windows[hwnd][2]), patch.object(
            discovery, "window_identity", side_effect=lambda hwnd, *rest: {"exe": "app.exe", "pid": 7, "hwnd": hwnd, "started": 1}
        ):
            listed = discovery.open_windows()
        self.assertEqual([(w["hwnd"], w["title"]) for w in listed], [(1, "budget.xlsx"), (2, "")])


class DesktopTargetContract(unittest.TestCase):
    def test_a_window_is_named_by_the_installed_app_it_belongs_to(self):
        from ocade_agent.discovery import app_key

        installed = {"suite.exe": {}, "sheets.exe": {}, "other.exe": {}}
        folder = r"C:\Program Files\Suite\program"
        # Its own program is an installed app: that is its name, whatever started it.
        self.assertEqual(app_key(folder + r"\Suite.exe", [r"C:\Windows\explorer.exe"], installed), "suite.exe")
        # A program an installed launcher in the same folder still runs: the launcher's app.
        self.assertEqual(app_key(folder + r"\suite.bin", [folder + r"\SUITE.EXE", r"C:\Windows\explorer.exe"], installed), "suite.exe")
        # The nearest such ancestor wins; one in another folder never lends its name.
        self.assertEqual(app_key(folder + r"\suite.bin", [r"D:\Else\other.exe", folder + r"\suite.exe"], installed), "suite.exe")
        self.assertEqual(app_key(folder + r"\suite.bin", [r"D:\Else\other.exe"], installed), "suite.bin")
        # A sibling shortcut in the folder is not ancestry: no guess between the suite's apps.
        self.assertEqual(app_key(folder + r"\suite.bin", [], installed), "suite.bin")
        self.assertEqual(app_key(folder + r"\suite.bin", [folder + r"\helper.exe"], installed), "suite.bin")

    def test_protected_control_value_is_never_read_or_returned(self):
        from types import SimpleNamespace
        from ocade_agent import windows_worker

        class Protected:
            element_info = SimpleNamespace(
                name="private-value", automation_id="private-id", control_type="Edit",
                element=SimpleNamespace(CurrentIsPassword=1),
            )

            def is_enabled(self):
                return True

            @property
            def iface_value(self):
                raise AssertionError("a protected control's value interface must stay unopened")

        self.assertEqual(windows_worker._describe(Protected()), {
            "name": "Protected text field", "automationId": "", "controlType": "Edit",
            "enabled": True, "protected": True,
        })

    def test_virtual_desktop_points_and_obscured_windows(self):
        from types import SimpleNamespace
        from ocade_agent.sandbox import Refused
        from ocade_agent.windows_worker import _check_point, _window_point

        point = _window_point((-1920, -540, -320, 660), 0.25, 0.5)
        self.assertEqual(point, (-1520, 60))
        screens = SimpleNamespace(MonitorFromPoint=lambda candidate, flags: candidate == point and flags == 0)
        window = SimpleNamespace(WindowFromPoint=lambda _point: 4, GetAncestor=lambda child, flags: 7)
        _check_point(7, point, screens, window)
        with self.assertRaisesRegex(Refused, "point_obscured"):
            _check_point(8, point, screens, window)
        with self.assertRaisesRegex(Refused, "point_off_screen"):
            _check_point(7, (1920, 0), screens, window)

    def test_packaged_keys_preserve_native_identity_across_labels_and_case(self):
        from types import SimpleNamespace
        from ocade_agent.discovery import _packaged_apps, _packaged_key

        class Item:
            def __init__(self, aumid, name):
                self.aumid, self.Name = aumid, name

            def ExtendedProperty(self, property_name):
                if property_name == "System.AppUserModel.ID":
                    return self.aumid

        aumid = "Fixture.Test_abcd!Main"
        items = [Item(aumid, "App label"), Item("other.desktop", "Unpackaged")]
        shell = SimpleNamespace(NameSpace=lambda _: SimpleNamespace(Items=lambda: items))
        [(key, label, native)] = list(_packaged_apps(shell))
        self.assertEqual((key, label, native), (_packaged_key(aumid.upper()), "App label", items[0]))
        self.assertRegex(key, r"^pkg-[0-9a-f]{32}$")
        self.assertNotEqual(key, _packaged_key("Fixture.Test_abcd!Alternate"))


if __name__ == "__main__":
    unittest.main()
