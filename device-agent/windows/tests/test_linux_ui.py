"""LNX-001…010: the Linux X11 ui_bridge on a virtual X server, through the real gateway.

The target is a small X11 app (`x11_fixture.py`) that records every key and click it receives in
a file, found the way a customer's app would be: through a desktop entry. Effects are checked in
that file, never in the bridge's own report. Runs only when an X server is reachable (CI runs the
companion suite on Xvfb); a Wayland-only session is refused by design and tested without a display.
"""

import os
import secrets
import shutil
import stat
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

import anyio

from ocade_agent import keys, linux_worker
from ocade_agent.gateway import Gateway
from ocade_agent.sandbox import Refused
from tests.test_gateway import intent

FIXTURE = Path(__file__).with_name("x11_fixture.py")


def x_server() -> bool:
    if not sys.platform.startswith("linux") or not os.environ.get("DISPLAY"):
        return False
    try:
        linux_worker.open_windows(1)
    except Refused:
        return False
    return True


class KeyContract(unittest.TestCase):
    def test_x11_events_translate_the_portable_key_list(self):
        events = keys.x11_events([{"text": "hi"}, {"press": "Mod+S"}, {"press": "Enter"}, {"press": "Shift+F5"}])
        self.assertEqual(events, [("text", "hi"), ("key", ord("s"), [0xFFE3]), ("key", 0xFF0D, []),
                                  ("key", 0xFFC2, [0xFFE1])])

    def test_what_has_no_x11_key_or_is_malformed_is_refused_before_any_input(self):
        for bad in ([{"press": "Cmd+S"}], [{"press": "Mod+Hyper"}], [{"text": "a\nb"}], [], [{"text": ""}], "text"):
            with self.subTest(bad=bad), self.assertRaises(Refused):
                keys.x11_events(bad)


class Sessions(unittest.TestCase):
    def test_a_wayland_session_is_refused_by_name_and_nothing_is_attempted(self):
        with patch.dict(os.environ, {"XDG_SESSION_TYPE": "wayland", "DISPLAY": ":0"}):
            for tool, arguments in ((linux_worker.apps_list, {}), (linux_worker.ui_inspect, {"window": {"hwnd": 1}})):
                with self.subTest(tool=tool.__name__):
                    self.assertEqual(tool(**arguments), {"refused": "wayland_unsupported", "maybeChanged": False})

    def test_no_display_is_refused_by_name(self):
        environment = {key: value for key, value in os.environ.items()
                       if key not in ("DISPLAY", "WAYLAND_DISPLAY", "XDG_SESSION_TYPE")}
        with patch.dict(os.environ, environment, clear=True):
            self.assertEqual(linux_worker.apps_list(), {"refused": "display_unavailable", "maybeChanged": False})
            wayland_only = {**environment, "WAYLAND_DISPLAY": "wayland-0"}
        with patch.dict(os.environ, wayland_only, clear=True):
            self.assertEqual(linux_worker.apps_list()["refused"], "wayland_unsupported")


class DesktopEntries(unittest.TestCase):
    """What a person could open by hand is listed; what they could not is not."""

    def test_only_launchable_entries_are_listed_with_the_program_they_start(self):
        home = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, home, True)
        applications = home / ".local/share/applications"
        applications.mkdir(parents=True)
        tool = home / "ocade-listed-tool"
        tool.write_text("#!/bin/sh\n")
        tool.chmod(0o755)
        plain = tool.with_name("plain-file")
        plain.write_text("not executable")
        entries = {
            "good": f"Type=Application\nName=Good\nExec={tool} --flag %U\n",
            "wrapped": f"Type=Application\nName=Wrapped\nExec=env LANG=C {tool} \"two words\" %f\n",
            "nodisplay": f"Type=Application\nName=No Display\nNoDisplay=true\nExec={tool}\n",
            "hidden": f"Type=Application\nName=Hidden\nHidden=true\nExec={tool}\n",
            "terminal": f"Type=Application\nName=Terminal\nTerminal=true\nExec={tool}\n",
            "link": "Type=Link\nName=A link\nURL=https://example.test\n",
            "missing": "Type=Application\nName=Missing\nExec=/no/such/program-ocade\n",
            "notexecutable": f"Type=Application\nName=Not Executable\nExec={plain}\n",
            "noname": f"Type=Application\nExec={tool}\n",
            "otherSection": f"[Desktop Action x]\nType=Application\nName=Action\nExec={tool}\n",
        }
        for name, body in entries.items():
            text = body if name == "otherSection" else "[Desktop Entry]\n" + body
            (applications / f"{name}.desktop").write_text(text)
        with patch.dict(os.environ, {"HOME": str(home), "XDG_DATA_HOME": str(home / ".local/share"),
                                     "XDG_DATA_DIRS": str(home / "nowhere")}):
            found = linux_worker.installed_apps()
        by_name = {entry["name"]: entry for entry in found}
        # Good and Wrapped start the same program: one app per program, the first by file name.
        self.assertEqual(set(by_name), {"Good"}, by_name.keys())
        self.assertEqual(by_name["Good"]["program"], str(tool))
        self.assertEqual(by_name["Good"]["arguments"], ["--flag"])
        self.assertEqual({entry["exe"] for entry in found}, {"ocade-listed-tool"})
        (applications / "good.desktop").unlink()
        with patch.dict(os.environ, {"HOME": str(home), "XDG_DATA_HOME": str(home / ".local/share"),
                                     "XDG_DATA_DIRS": str(home / "nowhere")}):
            wrapped = linux_worker.installed_apps()
        self.assertEqual([(a["name"], a["program"], a["arguments"]) for a in wrapped],
                         [("Wrapped", str(tool), ["two words"])], "env VAR=x is skipped, %f is dropped")


@unittest.skipUnless(x_server(), "needs an X11 display (Xvfb is enough)")
class X11Ladder(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp())
        self.home = Path(tempfile.mkdtemp())
        self.exe = f"ocadefixture{secrets.token_hex(4)}"
        self.log = self.root / "events.log"
        launcher = self.home / self.exe
        launcher.write_text(f'#!/bin/sh\nexec "{sys.executable}" "{FIXTURE}" "{self.log}"\n')
        launcher.chmod(launcher.stat().st_mode | stat.S_IXUSR)
        applications = self.home / ".local/share/applications"
        applications.mkdir(parents=True)
        (applications / f"{self.exe}.desktop").write_text(
            f"[Desktop Entry]\nType=Application\nName=Ocade Fixture {self.exe}\nExec={launcher} %U\n")
        self.environment = patch.dict(os.environ, {"HOME": str(self.home), "XDG_DATA_HOME": ""})
        self.environment.start()
        os.environ.pop("XDG_DATA_HOME")
        self.addCleanup(self.environment.stop)
        self.addCleanup(shutil.rmtree, self.root, True)
        self.addCleanup(shutil.rmtree, self.home, True)

    def lines(self) -> list[str]:
        return self.log.read_text().splitlines() if self.log.exists() else []

    def quiet(self) -> None:
        """The person is idle: the server has seen no input for the bridge's quiet period."""
        deadline = time.monotonic() + 15
        while (linux_worker._idle_seconds() or 0) < linux_worker.PERSON_QUIET_SECONDS + 0.5:
            self.assertLess(time.monotonic(), deadline, "the X server never went quiet")
            time.sleep(0.2)

    def launch(self, gateway):
        async def go():
            launched = await gateway.run(intent("apps.launch", {"exe": self.exe}), gateway.epoch)
            self.assertEqual(launched.get("status"), "observed", launched)
            return launched["evidence"]["window"]

        return go()

    def test_the_ladder_acts_only_on_the_leased_window_and_the_effects_are_real(self):
        async def steps():
            out = {}
            async with Gateway(str(self.root)) as gateway:
                def run(operation, arguments):
                    return gateway.run(intent(operation, arguments), gateway.epoch)

                out["list"] = await run("apps.list", {})
                out["unknown"] = await run("apps.launch", {"exe": "not-installed-anywhere"})
                window = await self.launch(gateway)
                out["window"] = window
                out["inspect"] = await run("ui.inspect", {"window": window})
                self.quiet()
                out["click"] = await run("ui.click_point", {"window": window, "x": 0.5, "y": 0.5,
                                                            "expectTitle": "Fixture"})
                self.quiet()
                out["changed"] = await run("ui.click_point", {"window": window, "x": 0.5, "y": 0.5,
                                                              "expectTitle": "Fixture"})
                self.quiet()
                out["wrong_title"] = await run("ui.click_point", {"window": window, "x": 0.1, "y": 0.1,
                                                                  "expectTitle": "Some other window"})
                out["keys"] = await run("ui.send_keys", {"window": window,
                                                         "keys": [{"text": "hi"}, {"press": "Mod+S"}, {"press": "Enter"}]})
                out["invoke"] = await run("ui.invoke", {"window": window, "element": {"name": "Save"}})
                out["forged"] = await run("ui.inspect", {"window": {**window, "started": window["started"] + 100}})
                out["gone"] = await run("ui.inspect", {"window": {**window, "hwnd": window["hwnd"] + 12345}})
            return out

        try:
            out = anyio.run(steps)
        finally:
            subprocess_kill(self.exe)
        with self.subTest("LNX-001 an installed app is found by its desktop entry and launched"):
            self.assertIn(f"Ocade Fixture {self.exe}", {a["name"] for a in out["list"]["evidence"]["installed"]})
            self.assertEqual(out["unknown"]["errorCode"] if "errorCode" in out["unknown"] else
                             out["unknown"].get("errorCode"), "app_not_installed", out["unknown"])
        with self.subTest("LNX-002 the window's title, image and no controls come back"):
            evidence = out["inspect"]["evidence"]
            self.assertEqual(evidence["title"], "OCADE X11 Fixture")
            self.assertEqual(evidence["elements"], [])
            self.assertTrue(evidence["noAccessibilityTree"])
            self.assertTrue(out["inspect"]["preview"])
        with self.subTest("LNX-003 a click lands where it was aimed, in the app, and changes its picture"):
            clicked = out["click"]["evidence"]
            self.assertEqual(clicked["after"]["imageChanged"], True, out["click"])
            lines = self.lines()
            hit = next(line for line in lines if line.startswith("click "))
            _, px, py = hit.split()
            self.assertLess(abs(int(px) - 160) + abs(int(py) - 110), 4, hit)
            self.assertEqual(sum(line.startswith("click ") for line in lines), 1, "the refused click must not land")
        with self.subTest("LNX-004 a target that changed since it was observed is refused"):
            self.assertEqual(out["changed"].get("errorCode"), "target_changed", out["changed"])
        with self.subTest("LNX-005 a window whose title is not the expected one is not clicked"):
            self.assertEqual(out["wrong_title"].get("errorCode"), "unexpected_window", out["wrong_title"])
        with self.subTest("LNX-006 typed text and shortcuts arrive in the focused app, in order"):
            keys_seen = [line for line in self.lines() if line.startswith("key ")]
            self.assertEqual(keys_seen, ["key h", "key i", "key Control_L", "key s ctrl", "key Return"])
        with self.subTest("LNX-007 a named control cannot be pressed without an accessibility tree"):
            self.assertEqual(out["invoke"].get("errorCode"), "no_accessibility_tree", out["invoke"])
        with self.subTest("LNX-008 a forged or stale lease is refused"):
            self.assertEqual(out["forged"].get("errorCode"), "window_changed", out["forged"])
            self.assertEqual(out["gone"].get("errorCode"), "window_gone", out["gone"])

    def test_watch_reports_a_real_change_in_the_leased_window_and_stays_quiet_otherwise(self):
        import threading

        async def steps():
            async with Gateway(str(self.root)) as gateway:
                return await self.launch(gateway)

        try:
            window = anyio.run(steps)
            direct = {k: window[k] for k in ("exe", "pid", "hwnd", "started")}
            linux_worker.ui_inspect(window=direct)
            self.quiet()
            still = linux_worker.ui_watch(window=direct, timeoutMs=1500)
            self.assertEqual(still.get("refused"), "not_changed", still)
            clicked: list[dict] = []
            timer = threading.Timer(0.8, lambda: clicked.append(linux_worker.ui_click_point(
                window=direct, x=0.5, y=0.5, expectTitle="Fixture")))
            timer.start()
            moved = linux_worker.ui_watch(window=direct, timeoutMs=8000)
            timer.join()
            self.assertTrue(moved["changed"], moved)
            self.assertTrue(any(line.startswith("click ") for line in self.lines()), "the change was a real click")
            self.assertEqual(clicked[0]["after"]["imageChanged"], True)
        finally:
            subprocess_kill(self.exe)

    def test_a_look_alike_window_stacked_over_the_leased_one_never_receives_the_click(self):
        """Overlapping windows: the leased window is raised first, so the click lands in it and
        the identical-looking window above it is untouched (the same pixels cannot fool the bridge)."""
        import subprocess

        async def steps():
            async with Gateway(str(self.root)) as gateway:
                return await self.launch(gateway)

        other_log = self.root / "other.log"
        covering = None
        try:
            window = anyio.run(steps)
            direct = {k: window[k] for k in ("exe", "pid", "hwnd", "started")}
            linux_worker.ui_inspect(window=direct)
            covering = subprocess.Popen([sys.executable, str(FIXTURE), str(other_log)])
            deadline = time.monotonic() + 10
            while not other_log.exists() and time.monotonic() < deadline:
                time.sleep(0.1)
            self.assertTrue(other_log.exists(), "the covering window never appeared")
            self.quiet()
            result = linux_worker.ui_click_point(window=direct, x=0.5, y=0.5, expectTitle="Fixture")
            self.assertNotIn("refused", result, result)
            self.assertEqual(sum(line.startswith("click ") for line in self.lines()), 1, "it lands in the leased window")
            self.assertNotIn("click ", other_log.read_text(), "and never in the window that only looks the same")
        finally:
            if covering is not None:
                covering.kill()
            subprocess_kill(self.exe)

    def test_when_the_window_cannot_be_raised_a_covered_point_is_refused_untouched(self):
        """A window manager that refuses the raise leaves the other window on top: no click at all."""
        import subprocess
        from unittest.mock import patch as patch_object

        async def steps():
            async with Gateway(str(self.root)) as gateway:
                return await self.launch(gateway)

        other_log = self.root / "other.log"
        covering = None
        try:
            window = anyio.run(steps)
            direct = {k: window[k] for k in ("exe", "pid", "hwnd", "started")}
            linux_worker.ui_inspect(window=direct)
            covering = subprocess.Popen([sys.executable, str(FIXTURE), str(other_log)])
            deadline = time.monotonic() + 10
            while not other_log.exists() and time.monotonic() < deadline:
                time.sleep(0.1)
            self.quiet()
            with patch_object.object(linux_worker, "_front", lambda _window: None):
                result = linux_worker.ui_click_point(window=direct, x=0.5, y=0.5, expectTitle="Fixture")
            self.assertEqual(result.get("refused"), "point_obscured", result)
            self.assertFalse(result["maybeChanged"])
            self.assertNotIn("click ", other_log.read_text())
            self.assertFalse(any(line.startswith("click ") for line in self.lines()))
        finally:
            if covering is not None:
                covering.kill()
            subprocess_kill(self.exe)

    def test_a_person_using_the_keyboard_stops_the_bridge_before_any_input(self):
        async def steps():
            async with Gateway(str(self.root)) as gateway:
                window = await self.launch(gateway)
                await gateway.run(intent("ui.inspect", {"window": window}), gateway.epoch)
                with patch.object(linux_worker, "_idle_seconds", return_value=0.1):
                    pass  # the gateway's worker is a separate process: the in-process check follows
                return window

        try:
            window = anyio.run(steps)
            direct = {k: window[k] for k in ("exe", "pid", "hwnd", "started")}
            shown = linux_worker._leased(direct)
            self.assertEqual(shown["title"], "OCADE X11 Fixture")
            before = self.lines()
            with patch.object(linux_worker, "_idle_seconds", return_value=0.1):
                result = linux_worker.ui_send_keys(window=direct, keys=[{"text": "x"}])
            self.assertEqual(result["refused"], "user_active", result)
            self.assertFalse(result["maybeChanged"])
            with patch.object(linux_worker, "_idle_seconds", return_value=None):
                unknown = linux_worker.ui_send_keys(window=direct, keys=[{"text": "x"}])
            self.assertEqual(unknown["refused"], "person_activity_unknown", unknown)
            self.assertEqual(self.lines(), before, "nothing may reach the app")
        finally:
            subprocess_kill(self.exe)

    def test_a_character_the_keyboard_cannot_type_is_refused_before_anything_is_sent(self):
        async def steps():
            async with Gateway(str(self.root)) as gateway:
                return await self.launch(gateway)

        try:
            window = anyio.run(steps)
            direct = {k: window[k] for k in ("exe", "pid", "hwnd", "started")}
            before = self.lines()
            result = linux_worker.ui_send_keys(window=direct, keys=[{"text": "ok\U0010FFFF"}])
            self.assertEqual(result["refused"], "key_unmappable", result)
            self.assertFalse(result["maybeChanged"])
            self.assertEqual(self.lines(), before)
        finally:
            subprocess_kill(self.exe)


def subprocess_kill(exe: str) -> None:
    import subprocess

    subprocess.run(["pkill", "-f", f"{exe}"], capture_output=True)
    subprocess.run(["pkill", "-f", "x11_fixture.py"], capture_output=True)


if __name__ == "__main__":
    unittest.main()
