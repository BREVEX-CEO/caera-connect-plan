"""RC17 regressions with synthetic window wrappers; these do not qualify native Windows."""
import sys
import threading
import unittest
import unittest.mock
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import ocade_accessibility as a11y  # noqa: E402
import ocade_computer as computer  # noqa: E402


class WindowIdentityTest(unittest.TestCase):
    def setUp(self):
        self.pc = computer.Computer.__new__(computer.Computer)
        self.pc.guard = unittest.mock.Mock()
        self.pc.never = {}
        self.pc.observe = unittest.mock.Mock(return_value={})

    @staticmethod
    def window(title="Report", handle=1):
        return SimpleNamespace(title=title, _hWnd=handle, visible=True, width=800, height=600,
                               isMinimized=False, activate=unittest.mock.Mock(),
                               close=unittest.mock.Mock(), minimize=unittest.mock.Mock(),
                               maximize=unittest.mock.Mock(), restore=unittest.mock.Mock())

    def action(self, windows, state="focus", title="Report", confirmed=True, cancel=None, front=None):
        gui = SimpleNamespace(getAllWindows=lambda: windows,
                              getActiveWindow=lambda: front or windows[0])
        with unittest.mock.patch.dict(sys.modules, {"pygetwindow": gui}), \
                unittest.mock.patch.object(computer, "_window_program", return_value=None), \
                unittest.mock.patch.object(computer.time, "sleep"):
            return self.pc._window("window", {"title": title, "state": state}, confirmed, cancel)

    def test_equal_titles_refuse_every_window_operation_even_when_confirmed(self):
        for state in ("focus", "close", "minimize", "maximize", "restore"):
            with self.subTest(state=state):
                windows = [self.window(handle=1), self.window(handle=2)]
                out = self.action(windows, state)
                self.assertEqual(out["status"], "failed", out)
                self.assertIn("Several windows match", out["summary"])
                for window in windows:
                    for method in ("activate", "close", "minimize", "maximize", "restore"):
                        getattr(window, method).assert_not_called()

    def test_equal_partial_titles_are_also_ambiguous(self):
        out = self.action([self.window("Report - Editor", 1), self.window("Report - Editor", 2)])
        self.assertEqual(out["status"], "failed", out)

    def test_a_unique_exact_title_can_be_closed_without_touching_partial_matches(self):
        exact, partial = self.window(), self.window("Report - Editor", 2)
        out = self.action([exact, partial], "close")
        self.assertEqual(out["status"], "done", out)
        exact.close.assert_called_once()
        partial.close.assert_not_called()

    def test_close_still_needs_confirmation(self):
        window = self.window()
        self.assertEqual(self.action([window], "close", confirmed=False)["status"], "needs_confirmation")
        window.close.assert_not_called()

    def test_stop_before_the_effect_closes_nothing(self):
        stop = threading.Event()
        stop.set()
        window = self.window()
        out = self.action([window], "close", cancel=stop)
        self.assertTrue(out.get("stopped"), out)
        window.close.assert_not_called()

    def test_focus_is_not_verified_by_a_different_window_with_the_same_title(self):
        selected, stolen = self.window(handle=1), self.window(handle=2)
        out = self.action([selected], front=stolen)
        self.assertEqual(out["status"], "failed", out)

    def test_focus_verifies_the_selected_handle(self):
        selected = self.window(handle=4)
        out = self.action([selected], front=self.window(handle=4))
        self.assertEqual(out["status"], "done", out)

    def test_a_missing_or_zero_handle_never_authorizes_a_window_effect(self):
        for handle in (None, 0):
            for state in ("focus", "close", "maximize"):
                with self.subTest(handle=handle, state=state):
                    window = self.window(handle=handle)
                    self.assertEqual(self.action([window], state)["status"], "failed")
                    window.activate.assert_not_called()
                    window.close.assert_not_called()
                    window.maximize.assert_not_called()

    def test_an_unidentified_front_window_does_not_verify_focus(self):
        out = self.action([self.window(handle=1)], front=self.window(handle=None))
        self.assertEqual(out["status"], "failed", out)

    def test_windows_screen_actions_require_an_identified_window(self):
        for handle in (None, 0):
            geometry = {"window": "Report", "windowHandle": handle}
            self.pc._observation = {"id": "s1", "at": computer.time.monotonic(), "geometry": geometry}
            self.pc._geometry = lambda: dict(geometry)
            with unittest.mock.patch.object(computer, "SYSTEM", "Windows"):
                self.assertIn("identity is unavailable", self.pc._stale("s1"))

    def test_screen_geometry_records_the_handle(self):
        front = self.window(handle=29)
        grab = unittest.mock.MagicMock()
        grab.__enter__.return_value.monitors = [
            {"left": 0, "top": 0, "width": 1920, "height": 1080}, {}]
        self.pc._gui = lambda: SimpleNamespace(getActiveWindow=lambda: front)
        with unittest.mock.patch.dict(sys.modules, {"mss": SimpleNamespace(MSS=lambda: grab)}):
            self.assertEqual(self.pc._geometry()["windowHandle"], 29)

    def test_same_title_and_bounds_do_not_keep_a_screen_observation_current(self):
        geometry = {"window": "Report", "windowHandle": 1, "box": (0, 0, 800, 600)}
        self.pc._observation = {"id": "s1", "at": computer.time.monotonic(), "geometry": geometry}
        self.pc._geometry = lambda: {**geometry, "windowHandle": 2}
        self.assertIn("different window", self.pc._stale("s1"))


class AccessibilityWindowIdentityTest(unittest.TestCase):
    def test_two_exact_titles_are_ambiguous(self):
        windows = [SimpleNamespace(Name="Report"), SimpleNamespace(Name="Report")]
        with self.assertRaises(a11y._Ambiguous):
            a11y._pick(windows, "report")

    def test_two_equal_partial_titles_are_ambiguous(self):
        windows = [SimpleNamespace(Name="Report - Editor"), SimpleNamespace(Name="Report - Editor")]
        with self.assertRaises(a11y._Ambiguous):
            a11y._pick(windows, "report")

    def test_unique_exact_title_wins_over_a_partial_match(self):
        windows = [SimpleNamespace(Name="Report"), SimpleNamespace(Name="Report - Editor")]
        self.assertIs(a11y._pick(windows, "report"), windows[0])

    def test_no_match_is_none(self):
        self.assertIsNone(a11y._pick([SimpleNamespace(Name="Other")], "report"))

    def test_inspect_refuses_duplicate_titles_before_reading_any_controls(self):
        root = SimpleNamespace(GetChildren=lambda: [SimpleNamespace(Name="Report"),
                                                    SimpleNamespace(Name="Report")])
        auto = SimpleNamespace(GetRootControl=lambda: root,
                               UIAutomationInitializerInThread=unittest.mock.MagicMock)
        with unittest.mock.patch.object(a11y, "_uia", return_value=auto), \
                unittest.mock.patch.object(a11y, "_protected") as protected:
            out = a11y.inspect("Report")
        self.assertEqual(out["status"], "failed", out)
        protected.assert_not_called()


if __name__ == "__main__":
    unittest.main()
