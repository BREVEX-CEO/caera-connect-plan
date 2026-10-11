"""ui_act asks controls for patterns by id. Found with DaVinci Resolve: its page switches are check
boxes, and uiautomation's CheckBoxControl has no GetInvokePattern or GetSelectionItemPattern at
all, so "invoke" and "select" failed with AttributeError instead of pressing or explaining."""
import re
import sys
import unittest
import unittest.mock
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import ocade_accessibility as a11y  # noqa: E402

IDS = SimpleNamespace(InvokePattern=1, TogglePattern=2, SelectionItemPattern=3,
                      ExpandCollapsePattern=4, ValuePattern=5)


class CheckBox:
    """Only what a uiautomation CheckBoxControl has: GetPattern, no other typed getters."""
    ControlTypeName = "CheckBoxControl"
    Name = "Edit"
    IsPassword = False
    IsEnabled = True

    def __init__(self):
        self.toggle = unittest.mock.Mock()
        self.Click = unittest.mock.Mock()

    def GetPattern(self, pattern_id):
        return self.toggle if pattern_id == IDS.TogglePattern else None


class ActTest(unittest.TestCase):
    def act(self, control, op, cancel=None, age=0.0):
        a11y._State.held["u9"] = {"window": (1,), "refs": {"a1": ((2,), "CheckBox", "Edit")},
                                  "at": a11y.time.monotonic() - age}
        auto = SimpleNamespace(PatternId=IDS, UIAutomationInitializerInThread=unittest.mock.MagicMock)
        never = re.compile(r"(?!)")
        with unittest.mock.patch.object(a11y, "_uia", return_value=auto), \
                unittest.mock.patch.object(a11y, "_by_runtime_id", return_value=SimpleNamespace(Name="App")), \
                unittest.mock.patch.object(a11y, "_find", return_value=control), \
                unittest.mock.patch.object(a11y, "_gates", return_value=(never, never, never)), \
                unittest.mock.patch.object(a11y, "_protected", return_value=False), \
                unittest.mock.patch.object(a11y, "inspect", return_value={"observation": {}}), \
                unittest.mock.patch.object(a11y.time, "sleep"):
            return a11y.act({"observationId": "u9", "ref": "a1", "op": op}, confirmed=False, cancel=cancel)

    def test_stop_during_the_checks_presses_nothing(self):
        import threading
        stop = threading.Event()
        stop.set()
        box = CheckBox()
        out = self.act(box, "invoke", cancel=stop)
        self.assertTrue(out.get("stopped"), out)
        box.toggle.Toggle.assert_not_called()
        box.Click.assert_not_called()

    def test_an_old_observation_is_never_acted_on(self):
        box = CheckBox()
        out = self.act(box, "invoke", age=a11y.OBSERVATION_MAX_AGE_S + 1)
        self.assertEqual(out["status"], "stale", out)
        box.toggle.Toggle.assert_not_called()

    def test_invoke_on_a_check_box_presses_it(self):
        box = CheckBox()
        out = self.act(box, "invoke")
        self.assertEqual(out["status"], "done", out)
        box.toggle.Toggle.assert_called_once()
        box.Click.assert_not_called()

    def test_an_op_the_control_lacks_is_explained_not_a_crash(self):
        for op in ("select", "expand", "collapse"):
            out = self.act(CheckBox(), op)
            self.assertEqual(out["status"], "failed", op)
            self.assertIn("use invoke", out["summary"])

    def test_without_any_pattern_invoke_clicks(self):
        box = CheckBox()
        box.GetPattern = lambda pattern_id: None
        self.assertEqual(self.act(box, "invoke")["status"], "done")
        box.Click.assert_called_once()


if __name__ == "__main__":
    unittest.main()


@unittest.skipUnless(sys.platform == "win32", "Windows display affinity")
class ProtectedSurfaceTest(unittest.TestCase):
    """Whatever its name, a window that hides itself from capture is never read or operated."""

    def test_a_window_excluded_from_capture_is_protected(self):
        import ctypes

        def affinity(value):
            def read(handle, out):
                ctypes.cast(out, ctypes.POINTER(ctypes.c_uint)).contents.value = value
                return 1
            return read

        window = SimpleNamespace(NativeWindowHandle=4242, ProcessId=0, GetParentControl=lambda: None)
        with unittest.mock.patch.object(a11y, "_owner", return_value="any-unknown-app.exe"):
            with unittest.mock.patch.object(ctypes.windll.user32, "GetWindowDisplayAffinity", affinity(0x11)):
                self.assertTrue(a11y._protected(window))
            with unittest.mock.patch.object(ctypes.windll.user32, "GetWindowDisplayAffinity", affinity(0)):
                self.assertFalse(a11y._protected(window))
