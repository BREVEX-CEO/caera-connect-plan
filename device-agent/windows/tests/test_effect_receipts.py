"""Windows bridge failure contracts; fake providers deliberately fail after an effect.

These isolate bridge dispatch/readback/COM lifecycle. Real native app and lease
tests remain mandatory elsewhere; these are not customer or native-app proof.
"""
import ctypes
import json
import sys
import threading
import unittest
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
        with patch.object(worker, "_leased", return_value=object()), patch.object(
            worker, "_element", return_value=provider
        ), patch.object(worker, "_person_quiet"):
            try:
                worker.ui_invoke(window={}, element={})
            except RuntimeError:
                pass
        self.assertEqual(calls, ["invoke"], "an uncertain dispatched mutation cannot fall through to a second one")

    def test_value_readback_compares_the_complete_value_not_a_preview(self):
        from ocade_agent import windows_worker as worker
        class Provider:
            current = ""
            missing = False
            @property
            def iface_value(self): return self
            @property
            def CurrentValue(self): return self.current
            def SetValue(self, requested): self.current = None if self.missing else requested[:200]
        for value, missing in ((uuid.uuid4().hex + "x" * 400, False), ("None", True)):
            with self.subTest(missing=missing):
                provider = Provider()
                provider.missing = missing
                with patch.object(worker, "_leased", return_value=object()), patch.object(
                    worker, "_element", return_value=provider
                ), patch.object(worker, "_person_quiet"), patch.object(
                    worker, "_describe", side_effect=lambda _: {"value": (provider.current or "")[:200]}
                ):
                    result = worker.ui_set_value(window={}, element={}, value=value)
                self.assertFalse(result["matches"], "a preview or missing readback must not prove the full requested value")

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
