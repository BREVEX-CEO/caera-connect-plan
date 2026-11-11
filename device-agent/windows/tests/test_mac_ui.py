"""MAC-001…011: the macOS ui_bridge (Accessibility) on a real Mac desktop, through the real gateway.

The target is an AppKit app this test compiles under a random name, so nothing about it is known
to the product in advance: it is found the way a customer's app would be. Effects are checked
independently (the file the app writes). Runs only on macOS with Accessibility granted to this
process (a GitHub macos runner qualifies; it is not a customer Mac).
"""

import plistlib
import secrets
import shutil
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path

import anyio

from ocade_agent.gateway import Gateway
from tests.test_gateway import intent

APP = """
import Cocoa
class Note: NSObject, NSApplicationDelegate {
  var window: NSWindow!
  var box: NSTextField!
  let path: String
  init(path: String) { self.path = path }
  func applicationDidFinishLaunching(_ n: Notification) {
    window = NSWindow(contentRect: NSRect(x: 200, y: 300, width: 420, height: 200),
                      styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
    window.title = "Ledger Note"
    box = NSTextField(frame: NSRect(x: 20, y: 130, width: 360, height: 24))
    box.identifier = NSUserInterfaceItemIdentifier("noteBox")
    let save = NSButton(title: "Save", target: self, action: #selector(save(_:)))
    save.frame = NSRect(x: 20, y: 70, width: 120, height: 32)
    save.identifier = NSUserInterfaceItemIdentifier("saveButton")
    window.contentView!.addSubview(box)
    window.contentView!.addSubview(save)
    window.makeKeyAndOrderFront(nil)
    NSApp.activate(ignoringOtherApps: true)
    // F2 asks a modal question, as many apps do (a first-run welcome, a save-format choice).
    NSEvent.addLocalMonitorForEvents(matching: .keyDown) { event in
      if event.keyCode != 120 { return event }
      DispatchQueue.main.async { let alert = NSAlert(); alert.messageText = "Keep the note?"; alert.runModal() }
      return nil
    }
  }
  @objc func save(_ sender: Any) { try? box.stringValue.write(toFile: path, atomically: true, encoding: .utf8) }
}
let app = NSApplication.shared
app.setActivationPolicy(.regular)
let note = Note(path: CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "note.txt")
app.delegate = note
app.run()
"""


def trusted() -> bool:
    if sys.platform != "darwin":
        return False
    import ApplicationServices  # type: ignore[import-not-found]

    return bool(ApplicationServices.AXIsProcessTrusted())


@unittest.skipUnless(trusted(), "needs a Mac desktop with Accessibility granted")
class MacUiLadder(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp())
        self.exe = f"ocadefixture{secrets.token_hex(4)}"
        self.bundle = Path.home() / "Applications" / f"{self.exe}.app"
        (self.bundle / "Contents/MacOS").mkdir(parents=True)
        source = Path(tempfile.mkdtemp()) / "app.swift"
        source.write_text(APP)
        subprocess.run(["swiftc", "-O", "-o", str(self.bundle / "Contents/MacOS" / self.exe), str(source)], check=True)
        (self.bundle / "Contents/Info.plist").write_bytes(plistlib.dumps({
            "CFBundleExecutable": self.exe, "CFBundleIdentifier": f"test.ocade.{self.exe}", "CFBundleName": self.exe,
            "CFBundlePackageType": "APPL", "NSPrincipalClass": "NSApplication"}))
        (self.root / "note.txt").write_text("")

    def tearDown(self):
        subprocess.run(["pkill", "-x", self.exe], capture_output=True)
        shutil.rmtree(self.bundle, ignore_errors=True)

    def note(self) -> str:
        return (self.root / "note.txt").read_text()

    def test_mac_ladder(self):
        import ApplicationServices as AX  # type: ignore[import-not-found]
        import Quartz  # type: ignore[import-not-found]

        async def steps():
            out = {}
            async with Gateway(str(self.root)) as gateway:
                def run(op, args):
                    return gateway.run(intent(op, args), gateway.epoch)

                out["list"] = await run("apps.list", {})
                out["unknown"] = await run("apps.launch", {"exe": "not-installed-anywhere"})
                out["launch"] = await run("apps.launch", {"exe": self.exe, "open": "note.txt"})
                window = out["launch"]["evidence"]["window"]
                out["inspect"] = await run("ui.inspect", {"window": window})
                box = {"automationId": "noteBox"}
                out["set"] = await run("ui.set_value", {"window": window, "element": box, "value": "Quarterly GREEN"})
                out["invoke"] = await run("ui.invoke", {"window": window, "element": {"automationId": "saveButton"}})
                time.sleep(0.5)
                out["after_invoke"] = self.note()
                await run("ui.set_value", {"window": window, "element": box, "value": ""})
                out["keys"] = await run("ui.send_keys", {"window": window, "element": box, "keys": [
                    {"text": "typed by keyz"}, {"press": "Backspace"}, {"text": "s"}]})
                time.sleep(0.5)
                await run("ui.invoke", {"window": window, "element": {"automationId": "saveButton"}})
                time.sleep(0.5)
                out["after_keys"] = self.note()
                # Another app is in front: the keys still reach the leased window, or none are sent.
                import AppKit  # type: ignore[import-not-found]

                subprocess.run(["open", "-a", "Finder"], check=True)
                for _ in range(50):
                    front = AppKit.NSWorkspace.sharedWorkspace().frontmostApplication()
                    if front is not None and front.bundleIdentifier() == "com.apple.finder":
                        break
                    time.sleep(0.1)
                await run("ui.set_value", {"window": window, "element": box, "value": ""})
                out["behind"] = await run("ui.send_keys", {"window": window, "element": box, "keys": [{"text": "from behind"}]})
                time.sleep(0.5)
                await run("ui.invoke", {"window": window, "element": {"automationId": "saveButton"}})
                time.sleep(0.5)
                out["after_behind"] = self.note()
                # The app asks a modal question: it is answered as its own window, never typed past.
                out["ask"] = await run("ui.send_keys", {"window": window, "element": box, "keys": [{"press": "F2"}]})
                time.sleep(1)
                out["blocked"] = await run("ui.send_keys", {"window": window, "keys": [{"text": "lost"}]})
                listed = await run("apps.list", {})
                out["dialog"] = next((w for w in listed["evidence"]["windows"]
                                      if w["pid"] == window["pid"] and w["hwnd"] != window["hwnd"]), None)
                if out["dialog"]:
                    out["answer"] = await run("ui.send_keys", {"window": out["dialog"], "keys": [{"press": "Enter"}]})
                time.sleep(1)
                out["after_dialog"] = await run("ui.send_keys", {"window": window, "element": box, "keys": [{"text": "!"}]})
                out["forged"] = await run("ui.inspect", {"window": window | {"pid": window["pid"] + 4}})
                out["ambiguous"] = await run("ui.invoke", {"window": window, "element": {}})

                time.sleep(1)  # the person presses a key: JARVIS's hands pause
                for down in (True, False):
                    Quartz.CGEventPost(Quartz.kCGHIDEventTap, Quartz.CGEventCreateKeyboardEvent(None, 56, down))
                out["person"] = await run("ui.set_value", {"window": window, "element": box, "value": "too soon"})
                time.sleep(2)

                await run("ui.set_value", {"window": window, "element": box, "value": "saved by click"})
                moved = await run("ui.inspect", {"window": window})
                x0, y0, x1, y1 = next(e["box"] for e in moved["evidence"]["elements"] if e["automationId"] == "saveButton")
                out["click"] = await run("ui.click_point", {"window": window, "x": (x0 + x1) / 2, "y": (y0 + y1) / 2,
                                                            "expectTitle": "Ledger Note"})
                time.sleep(0.8)
                out["after_click"] = self.note()

                ax_app = AX.AXUIElementCreateApplication(window["pid"])
                _, windows = AX.AXUIElementCopyAttributeValue(ax_app, "AXWindows", None)
                AX.AXUIElementSetAttributeValue(windows[0], "AXMinimized", True)
                time.sleep(1.5)
                out["minimized"] = await run("ui.set_value", {"window": window, "element": box, "value": "x"})
                subprocess.run(["pkill", "-x", self.exe])
                time.sleep(1.5)
                out["closed"] = await run("ui.inspect", {"window": window})
            return out

        out = anyio.run(steps)
        with self.subTest("MAC-001 an unseen installed app is discovered"):
            self.assertIn(self.exe, [a["exe"] for a in out["list"]["evidence"]["installed"]])
        with self.subTest("MAC-002 an app that is not installed is refused"):
            self.assertEqual(out["unknown"]["errorCode"], "app_not_installed")
        with self.subTest("MAC-003 launch leases the new window"):
            self.assertEqual(out["launch"]["status"], "observed", out["launch"])
        with self.subTest("MAC-004 inspect lists accessible controls with boxes and an image"):
            ids = {e["automationId"] for e in out["inspect"]["evidence"]["elements"]}
            self.assertTrue({"noteBox", "saveButton"} <= ids, out["inspect"])
            self.assertTrue(out["inspect"].get("preview"))
        with self.subTest("MAC-005 set value reads back; press has the app's real effect"):
            self.assertTrue(out["set"]["evidence"]["matches"], out["set"])
            self.assertEqual(out["after_invoke"], "Quarterly GREEN")
        with self.subTest("MAC-006 typed keys go into the named control"):
            self.assertEqual(out["keys"]["status"], "observed", out["keys"])
            self.assertEqual(out["after_keys"], "typed by keys")
        with self.subTest("MAC-013 keys reach the leased window when another app was in front"):
            self.assertEqual(out["behind"]["status"], "observed", out["behind"])
            self.assertEqual(out["after_behind"], "from behind")
        with self.subTest("MAC-014 a modal dialog of the app is answered first; nothing is typed past it"):
            self.assertEqual(out["ask"]["status"], "observed", out["ask"])
            self.assertEqual(out["blocked"]["errorCode"], "window_blocked", out["blocked"])
            # Nothing was typed, so the task plans again instead of waiting on an unknown effect.
            self.assertEqual((out["blocked"]["status"], out["blocked"]["maybeChanged"]), ("not_applied", False))
            self.assertIsNotNone(out["dialog"], "the dialog is listed as a window of its own")
            self.assertEqual(out["answer"]["status"], "observed", out["answer"])
            self.assertEqual(out["after_dialog"]["status"], "observed", out["after_dialog"])
        with self.subTest("MAC-007 a forged lease is refused"):
            self.assertIn(out["forged"]["errorCode"], ("window_changed",))
        with self.subTest("MAC-008 a click at the inspected box lands"):
            self.assertEqual(out["click"]["status"], "observed", out["click"])
            self.assertEqual(out["after_click"], "saved by click")
        with self.subTest("MAC-009 a minimized window is not acted on"):
            self.assertEqual(out["minimized"]["errorCode"], "window_minimized")
        with self.subTest("MAC-010 a closed window is gone"):
            self.assertEqual(out["closed"]["errorCode"], "window_gone")
        with self.subTest("MAC-011 an empty element description is ambiguous"):
            self.assertEqual(out["ambiguous"]["errorCode"], "element_ambiguous")
        with self.subTest("MAC-012 the person's input pauses mutations"):
            self.assertEqual(out["person"]["errorCode"], "user_active")



class AxEventContract(unittest.TestCase):
    def test_an_installed_app_resolves_to_the_program_its_bundle_starts(self):
        """The scripted route needs an app's real program (its command-line mode), found from
        the bundle by the same name apps.list gives; a random bundle, nothing known in advance."""
        import plistlib
        import tempfile
        from pathlib import Path
        from unittest.mock import patch

        from ocade_agent import mac_worker

        with tempfile.TemporaryDirectory() as folder:
            bundle = Path(folder) / "Fixture Studio.app" / "Contents"
            (bundle / "MacOS").mkdir(parents=True)
            (bundle / "Info.plist").write_bytes(plistlib.dumps({"CFBundleExecutable": "FixtureStudio"}))
            with patch.object(mac_worker, "_app_dirs", lambda: [Path(folder)]):
                [found] = mac_worker.installed_apps()
        self.assertEqual((found["name"], found["exe"]), ("Fixture Studio", "fixturestudio"))
        self.assertEqual(found["program"], str(bundle / "MacOS" / "FixtureStudio"), "the bundle's own case")

    def test_secure_ax_field_is_redacted_before_value_lookup(self):
        from unittest.mock import patch
        from ocade_agent import mac_worker

        def attribute(_element, name):
            if name == "AXValue":
                raise AssertionError("a secure field's value must not be read")
            return {"AXSubrole": "AXSecureTextField", "AXTitle": "private-value",
                    "AXIdentifier": "private-id", "AXRole": "AXTextField"}.get(name)

        with patch.object(mac_worker, "_attribute", side_effect=attribute):
            evidence = mac_worker._describe(object(), (0, 0, 100, 100))
        self.assertTrue(evidence["protected"])
        self.assertEqual(evidence["name"], "Protected text field")
        self.assertEqual(evidence["automationId"], "")
        self.assertNotIn("value", evidence)

    def test_native_observer_runs_and_detaches_at_the_action_boundary(self):
        import sys
        from types import SimpleNamespace
        from unittest.mock import Mock, patch
        from ocade_agent.mac_worker import _ax_change_events

        callback = None
        closures = []

        def callback_for(function):
            def closure(python_function):  # what PyObjC would hand to C
                closures.append((function, python_function))
                return python_function
            return closure

        def create(pid, receive, unused):
            nonlocal callback
            self.assertEqual(pid, 51)
            # Only a PyObjC closure is accepted (a plain function raises TypeError on macOS).
            self.assertEqual(closures, [(create, receive)])
            callback = receive
            return 0, "observer"

        ax = SimpleNamespace(
            AXObserverCreate=create, AXObserverAddNotification=Mock(return_value=0),
            AXObserverGetRunLoopSource=Mock(return_value="source"), AXObserverRemoveNotification=Mock(),
        )
        cf = SimpleNamespace(
            CFRunLoopGetCurrent=lambda: "loop", kCFRunLoopDefaultMode="default",
            CFRunLoopAddSource=Mock(), CFRunLoopRemoveSource=Mock(),
            CFRunLoopRunInMode=lambda *_: callback(None, None, "AXValueChanged", None),
        )
        objc = SimpleNamespace(callbackFor=callback_for)
        with patch.dict(sys.modules, {"ApplicationServices": ax, "CoreFoundation": cf, "objc": objc}):
            with _ax_change_events({"pid": 51}, "window", "control") as observed:
                self.assertEqual(observed, [])
        self.assertEqual(observed, ["AXValueChanged"])
        ax.AXObserverAddNotification.assert_any_call("observer", "control", "AXValueChanged", None)
        cf.CFRunLoopAddSource.assert_called_once_with("loop", "source", "default")
        cf.CFRunLoopRemoveSource.assert_called_once_with("loop", "source", "default")
        ax.AXObserverRemoveNotification.assert_any_call("observer", "control", "AXValueChanged")


if __name__ == "__main__":
    unittest.main()
