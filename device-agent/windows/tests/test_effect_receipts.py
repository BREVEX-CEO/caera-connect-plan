"""Windows bridge failure contracts; fake providers deliberately fail after an effect.

These isolate bridge dispatch/readback/COM lifecycle. Real native app and lease
tests remain mandatory elsewhere; these are not customer or native-app proof.
"""
import ctypes
import json
import sys
import threading
import unittest
import unittest.mock
import uuid
from unittest.mock import patch


@unittest.skipUnless(sys.platform == "win32", "needs Windows UI Automation and COM")
class NativeEffectReceipts(unittest.TestCase):
    def test_uncertain_invoke_is_never_followed_by_another_mutation_pattern(self):
        from ocade_agent import windows_worker as worker
        calls = []
        class Provider:
            def is_enabled(self): return True
            @property
            def iface_invoke(self): return self
            @property
            def iface_toggle(self): return self
            @property
            def iface_selection_item(self): return self
            def Invoke(self): calls.append("invoke"); raise RuntimeError("provider failed after invoking")
            def Toggle(self): calls.append("toggle"); raise RuntimeError("provider failed after toggling")
            def Select(self): calls.append("select"); raise RuntimeError("provider failed after selecting")
            invoke, toggle, select = Invoke, Toggle, Select
        provider = Provider()
        with patch.object(worker, "_actable", return_value=object()), patch.object(
            worker, "_element", return_value=provider
        ), patch.object(worker, "_person_quiet"):
            try:
                worker.ui_invoke(window={}, element={})
            except RuntimeError:
                pass
        self.assertEqual(calls, ["invoke"], "an uncertain dispatched mutation cannot fall through to a second one")

    def test_a_control_that_closed_its_window_is_still_reported_as_invoked(self):
        """Pressing a dialog's OK closes the dialog: the control can no longer be described, but
        the pattern call returned, so the step is observed, never an unknown effect that would
        stop the task for a person (run 43063439515 hit this with a dialog's Enter)."""
        from ocade_agent import windows_worker as worker
        class Provider:
            def is_enabled(self): return True
            @property
            def iface_invoke(self): return self
            def Invoke(self): pass
        with patch.object(worker, "_actable", return_value=object()), patch.object(
            worker, "_element", return_value=Provider()
        ), patch.object(worker, "_person_quiet"), patch.object(
            worker, "_describe", side_effect=RuntimeError("element not available")
        ):
            result = worker.ui_invoke(window={}, element={"name": "OK"})
        self.assertEqual(result["pattern"], "invoke")
        self.assertEqual(result["after"], {"unavailable": True})
        self.assertNotIn("refused", result)

    def test_value_readback_compares_the_complete_value_not_a_preview(self):
        from ocade_agent import windows_worker as worker
        class Provider:
            current = ""
            missing = False
            # An ordinary (not password) field, as UI Automation reports it.
            element_info = type("Info", (), {"element": type("Element", (), {"CurrentIsPassword": False})()})()
            @property
            def iface_value(self): return self
            @property
            def CurrentValue(self): return self.current
            def SetValue(self, requested): self.current = None if self.missing else requested[:200]
        for value, missing in ((uuid.uuid4().hex + "x" * 400, False), ("None", True)):
            with self.subTest(missing=missing):
                provider = Provider()
                provider.missing = missing
                with patch.object(worker, "_actable", return_value=object()), patch.object(
                    worker, "_element", return_value=provider
                ), patch.object(worker, "_person_quiet"), patch.object(
                    worker, "_describe", side_effect=lambda _: {"value": (provider.current or "")[:200]}
                ):
                    result = worker.ui_set_value(window={}, element={}, value=value)
                self.assertFalse(result["matches"], "a preview or missing readback must not prove the full requested value")

    def test_a_secure_desktop_is_refused_before_the_window_is_touched(self):
        """UAC or the lock screen holds input: refused as secure_desktop, nothing attempted."""
        from ocade_agent import windows_worker as worker
        import win32service  # type: ignore[import-not-found]

        probe = unittest.mock.Mock()
        with patch("win32gui.IsWindow", probe), patch(
            "win32service.OpenInputDesktop", side_effect=win32service.error(5, "OpenInputDesktop", "denied")
        ):
            result = worker.ui_inspect(window={"exe": "app.exe", "hwnd": 5, "pid": 7, "started": 1.0})
        self.assertEqual(result, {"refused": "secure_desktop", "maybeChanged": False})
        probe.assert_not_called()
        desktop = unittest.mock.Mock()
        with patch("win32service.OpenInputDesktop", return_value=desktop), patch(
            "win32service.GetUserObjectInformation", side_effect=["Winlogon", "Default"]
        ):
            self.assertTrue(worker._on_secure_desktop())
            self.assertFalse(worker._on_secure_desktop(), "the person's own desktop")
        self.assertEqual(desktop.CloseDesktop.call_count, 2)

    def test_a_window_held_by_a_dialog_is_refused_before_anything_is_attempted(self):
        from ocade_agent import windows_worker as worker
        element = unittest.mock.Mock()
        dialog = {"exe": "app.exe", "pid": 7, "hwnd": 6, "started": 1.0, "title": "Keep format?"}
        listed = [dialog, {**dialog, "hwnd": 5}, {**dialog, "pid": 8, "hwnd": 9}]
        with patch.object(worker, "_leased", return_value=object()), patch(
            "win32gui.IsWindowEnabled", return_value=False
        ), patch.object(worker, "_element", element), patch.object(worker, "_person_quiet"), patch.object(
            worker.discovery, "open_windows", lambda _limit: listed
        ):
            for operation, arguments in (("ui_invoke", {"element": {"name": "Save"}}),
                                         ("ui_set_value", {"element": {"name": "Note"}, "value": "x"}),
                                         ("ui_send_keys", {"keys": [{"text": "x"}]})):
                with self.subTest(operation):
                    result = getattr(worker, operation)(window={"hwnd": 5, "pid": 7}, **arguments)
                    # The dialog that holds the window is named with its lease; the window
                    # itself and other apps' windows are not.
                    self.assertEqual(result, {"refused": "window_blocked", "maybeChanged": False,
                                              "dialogs": [dialog]})
        element.assert_not_called()

    def test_a_window_that_does_not_come_forward_changed_nothing(self):
        """Bringing a window forward is not an effect: when it does not come forward (another
        app, or a dialog of its own app, keeps the foreground) no key was sent, so the step is
        not_applied and the task plans again instead of waiting on an unknown effect."""
        from ocade_agent import windows_worker as worker
        target = unittest.mock.Mock()
        target.window_text.return_value = "Ledger Note"
        typed = unittest.mock.Mock()
        for owner, code in ((99, "focus_lost"), (7, "window_blocked")):
            with self.subTest(code), patch.object(worker, "_actable", return_value=target), patch.object(
                worker, "_person_quiet"
            ), patch("win32gui.GetForegroundWindow", return_value=1234), patch(
                "win32process.GetWindowThreadProcessId", return_value=(1, owner)
            ), patch("pywinauto.keyboard.send_keys", typed), patch.object(
                worker.discovery, "open_windows", lambda _limit: []
            ):
                result = worker.ui_send_keys(window={"hwnd": 5, "pid": 7}, keys=[{"text": "x"}])
                expected = {"refused": code, "maybeChanged": False}
                self.assertEqual(result, expected | ({"dialogs": []} if code == "window_blocked" else {}))
        target.set_focus.assert_called()
        typed.assert_not_called()

    def test_worker_call_balances_its_native_com_initialization(self):
        import pythoncom
        from ocade_agent import windows_worker as worker
        from ocade_agent.sandbox import Refused

        records, errors = [], []
        initialize, uninitialize = pythoncom.CoInitializeEx, pythoncom.CoUninitialize

        def probe(mode):
            record = {"mode": mode, "events": [], "during": [], "outcomes": []}
            owned = False
            function = ctypes.WinDLL("ole32").CoGetApartmentType
            function.argtypes = [ctypes.POINTER(ctypes.c_int), ctypes.POINTER(ctypes.c_int)]
            function.restype = ctypes.c_long

            def apartment():
                kind, qualifier = ctypes.c_int(-1), ctypes.c_int(-1)
                result = function(ctypes.byref(kind), ctypes.byref(qualifier)) & 0xffffffff
                return [result, kind.value if result == 0 else None, qualifier.value if result == 0 else None]

            def initializing(flags):
                try:
                    result = initialize(flags)
                except pythoncom.com_error as error:
                    record["events"].append({"call": "initialize", "flags": flags,
                                             "error": error.hresult & 0xffffffff})
                    raise
                record["events"].append({"call": "initialize", "flags": flags, "success": True,
                                         "returned": repr(result), "apartment": apartment()})
                return result

            def uninitializing():
                result = uninitialize()
                record["events"].append({"call": "uninitialize", "apartment": apartment()})
                return result

            try:
                record["initial"] = apartment()
                if mode != "fresh":
                    initialize(pythoncom.COINIT_APARTMENTTHREADED if mode == "sta"
                               else pythoncom.COINIT_MULTITHREADED)
                    owned = True
                record["before"] = apartment()
                behaviors = ("return", "refuse", "raise", "return", "return")

                def body():
                    behavior = behaviors[len(record["during"])]
                    record["during"].append(apartment())
                    if behavior == "refuse":
                        raise Refused("probe_precondition")
                    if behavior == "raise":
                        raise RuntimeError("probe_readback_failure")
                    return {}

                with patch.object(pythoncom, "CoInitializeEx", initializing), patch.object(
                    pythoncom, "CoUninitialize", uninitializing
                ):
                    wrapped = worker._evidence(body)
                    for behavior in behaviors:
                        try:
                            result = wrapped()
                        except RuntimeError:
                            if behavior != "raise":
                                raise
                            record["outcomes"].append("raised")
                        else:
                            record["outcomes"].append(result)
                record["after"] = apartment()
            except BaseException as error:
                errors.append({"mode": mode, "error": repr(error)})
            finally:
                if owned:
                    uninitialize()  # release only this test's explicit caller-owned initialization
                record["released"] = apartment()
                records.append(record)

        for mode in ("fresh", "sta", "mta"):
            thread = threading.Thread(target=probe, args=(mode,), daemon=True)
            thread.start()
            thread.join(timeout=5)
            self.assertFalse(thread.is_alive(), "COM lifecycle probe must be bounded: " + mode)
        print("OCADE_NATIVE_COM_BALANCE:" + json.dumps({"records": records, "errors": errors}, sort_keys=True))
        self.assertFalse(errors, errors)
        self.assertEqual(len(records), 3)
        for record in records:
            with self.subTest(mode=record["mode"]):
                initial = record["initial"]
                # An uninitialized thread can inherit the process MTA implicitly.
                # HRESULT S_OK alone cannot distinguish that state from leaked initialization:
                # https://learn.microsoft.com/en-us/windows/win32/api/objidl/ne-objidl-apttypequalifier
                self.assertTrue(initial[0] == 0x800401F0 or initial == [0, 1, 1], record)
                self.assertEqual(record["after"], record["before"],
                                 "each call must restore the caller's exact apartment state")
                self.assertEqual(record["released"], initial,
                                 "the worker must not consume or leak the caller's COM reference")
                successes = [event for event in record["events"] if event.get("success")]
                releases = [event for event in record["events"] if event["call"] == "uninitialize"]
                self.assertEqual(len(successes), 5, record)
                self.assertEqual(len(releases), 5, record)
                self.assertTrue(all(event.get("error", 0x80010106) == 0x80010106
                                    for event in record["events"]), record)
                self.assertEqual(len(record["during"]), 5)
                self.assertTrue(all(state[0] == 0 and state[2] == 0
                                    for state in record["during"]), record)
                self.assertEqual(record["outcomes"],
                                 [{}, {"refused": "probe_precondition", "maybeChanged": False},
                                  "raised", {}, {}], record)


class MacFront(unittest.TestCase):
    """macOS activation through fake AppKit/Accessibility modules (no Mac needed)."""

    def run_front(self, frontmost_pid, focused, windows=()):
        from ocade_agent import mac_worker as worker
        target, actions = object(), []
        running = unittest.mock.Mock()
        running.activateWithOptions_.side_effect = lambda _: actions.append("activate")
        front = unittest.mock.Mock()
        front.processIdentifier.return_value = frontmost_pid
        appkit = unittest.mock.Mock()
        appkit.NSRunningApplication.runningApplicationWithProcessIdentifier_.return_value = running
        appkit.NSWorkspace.sharedWorkspace.return_value.frontmostApplication.return_value = front
        ax = unittest.mock.Mock()
        ax.AXUIElementPerformAction.side_effect = lambda *_: actions.append("raise")
        ax.AXUIElementSetAttributeValue.side_effect = lambda *_: actions.append("frontmost")
        cf = unittest.mock.Mock()
        cf.CFEqual.side_effect = lambda a, b: a is b
        modules = {"AppKit": appkit, "ApplicationServices": ax, "CoreFoundation": cf}
        with patch.dict(sys.modules, modules), \
                patch.object(worker, "_attribute", lambda _, name: target if focused else None), \
                patch.object(worker.time, "sleep"), \
                patch.object(worker, "open_windows", lambda _limit: list(windows)):
            worker._front({"exe": "app", "pid": 42, "hwnd": 1, "started": 5.0}, target)
        return actions

    def test_a_window_already_in_front_is_still_activated_so_its_dialog_takes_the_keys(self):
        self.assertEqual(self.run_front(42, focused=True), ["raise", "frontmost", "activate"])

    def test_a_window_behind_another_app_is_raised_then_refused_if_it_stays_behind(self):
        from ocade_agent.sandbox import Refused
        with self.assertRaises(Refused) as refused:
            self.run_front(7, focused=True)  # another app stays frontmost in the fake
        self.assertEqual(refused.exception.code, "focus_lost")

    def test_a_dialog_that_keeps_the_focus_is_named_with_its_lease(self):
        from ocade_agent.sandbox import Refused
        alert = {"exe": "app", "pid": 42, "hwnd": 2, "started": 5.0, "title": "Save?", "bounds": [0, 0, 1, 1]}
        other_app = {**alert, "pid": 7, "hwnd": 3}
        itself = {**alert, "hwnd": 1}
        with self.assertRaises(Refused) as refused:
            self.run_front(42, focused=False, windows=(alert, other_app, itself))
        self.assertEqual(refused.exception.code, "window_blocked")
        self.assertEqual(refused.exception.detail["dialogs"],
                         [{k: alert[k] for k in ("exe", "pid", "hwnd", "started", "title")}])
