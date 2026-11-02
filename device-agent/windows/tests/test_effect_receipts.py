"""Windows bridge failure contracts; fake providers deliberately fail after an effect.

These isolate bridge dispatch/readback/COM lifecycle. Real native app and lease
tests remain mandatory elsewhere; these are not customer or native-app proof.
"""
import ctypes
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
        value = uuid.uuid4().hex + "x" * 400
        class Provider:
            current = ""
            @property
            def iface_value(self): return self
            @property
            def CurrentValue(self): return self.current
            def SetValue(self, requested): self.current = requested[:200]
        provider = Provider()
        with patch.object(worker, "_leased", return_value=object()), patch.object(
            worker, "_element", return_value=provider
        ), patch.object(worker, "_person_quiet"), patch.object(
            worker, "_describe", side_effect=lambda _: {"value": provider.current[:200]}
        ):
            result = worker.ui_set_value(window={}, element={}, value=value)
        self.assertFalse(result["matches"], "a clipped provider result must not prove the full requested value")

    def test_worker_call_balances_its_native_com_initialization(self):
        import pythoncom
        from ocade_agent import windows_worker as worker
        results, errors = [], []
        def probe():
            try:
                wrapped = worker._evidence(lambda: {})
                for _ in range(5):
                    wrapped()
                function = ctypes.WinDLL("ole32").CoGetApartmentType
                function.argtypes = [ctypes.POINTER(ctypes.c_int), ctypes.POINTER(ctypes.c_int)]
                function.restype = ctypes.c_long
                apartment, qualifier = ctypes.c_int(), ctypes.c_int()
                results.append(function(ctypes.byref(apartment), ctypes.byref(qualifier)) & 0xffffffff)
            except BaseException as error:
                errors.append(repr(error))
            finally:
                if results and results[0] != 0x800401F0:
                    for _ in range(5):
                        pythoncom.CoUninitialize()
        thread = threading.Thread(target=probe, daemon=True)
        thread.start()
        thread.join(timeout=5)
        self.assertFalse(thread.is_alive(), "COM lifecycle probe must be bounded")
        self.assertFalse(errors, errors)
        self.assertEqual(results, [0x800401F0], "the fresh worker thread must be uninitialized after its calls")
