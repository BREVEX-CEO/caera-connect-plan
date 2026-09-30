"""Signed updates: only OCADE-signed, checksum-matching, healthy builds switch; failures roll back.

Run: python -m unittest discover -s jarvis-runtime/tests -p 'test_update.py'
"""
import base64
import contextlib
import hashlib
import io
import json
import os
import sys
import tempfile
import unittest
import zipfile
from unittest import mock
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import ocade_update as up  # noqa: E402
from cryptography.hazmat.primitives import serialization  # noqa: E402
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey  # noqa: E402


PROGRAM = up._executable(Path(".")).name  # ocade-agent.exe on Windows


def build(healthy: bool, program: str = PROGRAM) -> bytes:
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w") as bundle:
        info = zipfile.ZipInfo(program)
        info.external_attr = 0o755 << 16
        bundle.writestr(info, "healthy" if healthy else "sick")
    return out.getvalue()


up_real_health = up._health  # kept before any test replaces it


def fake_health(exe: Path) -> bool:
    """The platform's real process launch is replaced by reading the fixture's verdict."""
    return exe.read_text() == "healthy"


class UpdateTest(unittest.TestCase):
    def setUp(self):
        self.key = Ed25519PrivateKey.generate()
        self.public = base64.b64encode(self.key.public_key().public_bytes(
            serialization.Encoding.Raw, serialization.PublicFormat.Raw)).decode()
        self.root = Path(tempfile.mkdtemp())
        patcher = mock.patch.object(up, "_health", fake_health)
        patcher.start()
        self.addCleanup(patcher.stop)

    def release(self, version: str, archive: bytes) -> tuple[bytes, str, dict]:
        manifest = json.dumps({"version": version, "platforms": {up.platform_key(): {
            "url": "https://ocade.test/agent/x.zip", "sha256": hashlib.sha256(archive).hexdigest()}}}).encode()
        return manifest, base64.b64encode(self.key.sign(manifest)).decode(), json.loads(manifest)

    def test_refuses_unsigned_tampered_or_unkeyed_releases(self):
        manifest, signature, _ = self.release("1.0.0", build(True))
        with self.assertRaises(up.UpdateRefused):
            up.verify_manifest(manifest, signature, None)
        with self.assertRaises(up.UpdateRefused):
            up.verify_manifest(manifest.replace(b"1.0.0", b"9.9.9"), signature, self.public)
        self.assertEqual(up.verify_manifest(manifest, signature, self.public)["version"], "1.0.0")

    def test_installs_a_healthy_signed_build_and_keeps_one_to_roll_back_to(self):
        for version in ("1.0.0", "1.1.0", "1.2.0"):
            archive = build(True)
            _, _, manifest = self.release(version, archive)
            self.assertEqual(up.install(self.root, manifest, archive), version)
        layout = json.loads((self.root / "current.json").read_text())
        self.assertEqual((layout["current"], layout["previous"]), ("1.2.0", "1.1.0"))
        self.assertEqual(sorted(p.name for p in (self.root / "versions").iterdir()), ["1.1.0", "1.2.0"])

    def placed_by_installer(self, version: str) -> Path:
        """What the installer leaves: the program in versions/<version>, and nothing else."""
        folder = self.root / "versions" / version
        folder.mkdir(parents=True)
        (folder / PROGRAM).write_text("healthy")
        up.adopt(self.root, version)
        return folder / PROGRAM

    def update_to(self, version: str, healthy: bool = True) -> None:
        archive = build(healthy)
        up.install(self.root, self.release(version, archive)[2], archive)

    def layout(self) -> dict:
        return json.loads((self.root / "current.json").read_text())

    def test_the_installed_build_survives_every_update(self):
        """The login entry and the uninstaller run it: deleting it strands the computer."""
        launcher = self.placed_by_installer("1.0.0")
        for version in ("1.1.0", "1.2.0", "1.3.0", "1.4.0"):
            self.update_to(version)
            up.mark_healthy(self.root)
        self.assertTrue(launcher.is_file())
        self.assertEqual(sorted(p.name for p in (self.root / "versions").iterdir()),
                         ["1.0.0", "1.3.0", "1.4.0"])
        # And starting it still hands over to the newest build.
        self.assertEqual(up.launch_target(self.root).parent.name, "1.4.0")

    def test_a_newer_installer_over_an_updated_install_wins(self):
        self.placed_by_installer("1.0.0")
        self.update_to("1.1.0")
        self.placed_by_installer("2.0.0")
        self.assertEqual((self.layout()["current"], self.layout()["installed"]), ("2.0.0", "2.0.0"))
        # An older installer run afterwards does not take the computer backwards.
        self.placed_by_installer("1.5.0")
        self.assertEqual(self.layout()["current"], "2.0.0")

    def test_an_install_cut_off_half_way_changes_nothing_and_the_next_one_works(self):
        self.placed_by_installer("1.0.0")
        archive = build(True)
        manifest = self.release("2.0.0", archive)[2]

        def power_cut(self_zip, path):  # the program is half written, then the computer dies
            (Path(path) / PROGRAM).write_text("hea")
            raise OSError("power cut")

        with mock.patch.object(zipfile.ZipFile, "extractall", power_cut):
            with self.assertRaises(up.UpdateRefused):
                up.install(self.root, manifest, archive)
        self.assertEqual(self.layout()["current"], "1.0.0")
        self.assertFalse((self.root / "versions/2.0.0").exists())
        self.assertEqual(up.launch_target(self.root).parent.name, "1.0.0")
        self.assertEqual(up.install(self.root, manifest, archive), "2.0.0")

    def test_a_folder_left_by_a_killed_install_is_never_started(self):
        """Killed before the record was written: the folder exists, the record does not name it."""
        self.placed_by_installer("1.0.0")
        leftover = self.root / "versions/2.0.0"
        leftover.mkdir()
        (leftover / PROGRAM).write_text("hea")
        self.assertEqual(up.launch_target(self.root).parent.name, "1.0.0")
        self.update_to("2.0.0")  # the real install replaces the leftover
        self.assertEqual((leftover / PROGRAM).read_text(), "healthy")

    def test_a_damaged_record_is_repaired_from_the_build_that_is_there(self):
        self.placed_by_installer("1.0.0")
        (self.root / "current.json").write_text("{ not json")
        self.assertIsNone(up.launch_target(self.root))  # nothing to hand over to: the started build runs
        up.adopt(self.root, "1.0.0")
        self.assertEqual(self.layout()["current"], "1.0.0")
        (self.root / "current.json.tmp").write_text("half")  # a write cut off: ignored
        self.assertEqual(up.launch_target(self.root).parent.name, "1.0.0")

    def test_a_build_that_was_rolled_back_is_not_installed_again(self):
        self.placed_by_installer("1.0.0")
        self.update_to("2.0.0")
        for _ in range(3):
            up.launch_target(self.root)  # 2.0.0 never stays up
        self.assertEqual(self.layout()["current"], "1.0.0")
        self.assertEqual(self.layout()["installed"], "1.0.0")
        archive = build(True)
        with self.served("2.0.0", archive):
            self.assertIsNone(up.check("https://ocade.test", self.root, "1.0.0"))
        with self.served("2.0.1", archive):
            self.assertEqual(up.check("https://ocade.test", self.root, "1.0.0"), "2.0.1")

    def served(self, version: str, archive: bytes, url: str = "https://ocade.test/agent/x.zip"):
        """The release as the server would hand it over, signed with this test's key."""
        manifest = json.dumps({"version": version, "platforms": {up.platform_key(): {
            "url": url, "sha256": hashlib.sha256(archive).hexdigest()}}}).encode()
        signature = base64.b64encode(self.key.sign(manifest))
        files = {"manifest.json": manifest, "manifest.json.sig": signature, "x.zip": archive}
        stack = contextlib.ExitStack()
        stack.enter_context(mock.patch.object(up, "UPDATE_PUBLIC_KEY", self.public))
        stack.enter_context(mock.patch.object(
            up, "_get", lambda address, timeout: files[address.rsplit("/", 1)[1]]))
        return stack

    def test_an_older_or_equal_signed_release_is_never_installed(self):
        """A genuine old manifest replayed is a downgrade to a build with known flaws."""
        self.placed_by_installer("1.10.0")
        for stale in ("1.10.0", "1.9.0", "0.9.9"):
            with self.served(stale, build(True)):
                self.assertIsNone(up.check("https://ocade.test", self.root, "1.10.0"))
        self.assertEqual(self.layout()["current"], "1.10.0")
        with self.served("1.11.0", build(True)):
            self.assertEqual(up.check("https://ocade.test", self.root, "1.10.0"), "1.11.0")

    def test_a_release_with_a_bad_version_no_build_or_a_plain_link_is_refused(self):
        self.placed_by_installer("1.0.0")
        for version in ("2.0.0-beta", "../2", "two"):
            with self.served(version, build(True)):
                with self.assertRaises(up.UpdateRefused):
                    up.check("https://ocade.test", self.root, "1.0.0")
        with self.served("2.0.0", build(True), url="http://ocade.test/agent/x.zip"):
            with self.assertRaises(up.UpdateRefused):
                up.check("https://ocade.test", self.root, "1.0.0")
        self.assertEqual(self.layout()["current"], "1.0.0")

    def test_an_archive_that_writes_outside_its_folder_is_refused(self):
        self.placed_by_installer("1.0.0")
        out = io.BytesIO()
        with zipfile.ZipFile(out, "w") as bundle:
            bundle.writestr(PROGRAM, "healthy")
            bundle.writestr("../../escaped.txt", "outside")
        with self.assertRaises(up.UpdateRefused):
            up.install(self.root, self.release("2.0.0", out.getvalue())[2], out.getvalue())
        self.assertFalse((self.root.parent / "escaped.txt").exists())
        self.assertFalse((self.root / "escaped.txt").exists())
        self.assertEqual(self.layout()["current"], "1.0.0")

    def test_a_program_that_really_cannot_start_is_unhealthy(self):
        """The real launch, not the fixture: a file that is not a program fails its health check."""
        self.placed_by_installer("1.0.0")
        patcher = mock.patch.object(up, "_health", up_real_health)
        patcher.start()
        self.addCleanup(patcher.stop)
        with self.assertRaises(up.UpdateRefused):
            self.update_to("2.0.0")
        self.assertEqual(self.layout()["current"], "1.0.0")


    def test_a_download_that_does_not_match_is_refused(self):
        _, _, manifest = self.release("1.0.0", build(True))
        with self.assertRaises(up.UpdateRefused):
            up.install(self.root, manifest, build(False))

    def test_an_unhealthy_build_never_becomes_current(self):
        good = build(True)
        up.install(self.root, self.release("1.0.0", good)[2], good)
        bad = build(False)
        with self.assertRaises(up.UpdateRefused):
            up.install(self.root, self.release("2.0.0", bad)[2], bad)
        self.assertEqual(json.loads((self.root / "current.json").read_text())["current"], "1.0.0")
        self.assertFalse((self.root / "versions/2.0.0").exists())

    def test_rolls_back_after_repeated_failed_starts(self):
        for version in ("1.0.0", "2.0.0"):
            archive = build(True)
            up.install(self.root, self.release(version, archive)[2], archive)
        self.assertEqual(up.launch_target(self.root).parent.name, "2.0.0")
        up.launch_target(self.root)  # it never reported healthy: second failed start
        self.assertEqual(up.launch_target(self.root).parent.name, "1.0.0")
        up.mark_healthy(self.root)
        self.assertEqual(json.loads((self.root / "current.json").read_text())["failedStarts"], 0)

    def test_a_release_without_the_program_or_a_broken_archive_changes_nothing(self):
        good = build(True)
        up.install(self.root, self.release("1.0.0", good)[2], good)
        for archive in (build(True, program="something-else"), b"not a zip at all"):
            with self.assertRaises(up.UpdateRefused):
                up.install(self.root, self.release("2.0.0", archive)[2], archive)
            self.assertEqual(json.loads((self.root / "current.json").read_text())["current"], "1.0.0")
            self.assertFalse((self.root / "versions/2.0.0").exists())


class ScheduleTest(unittest.TestCase):
    def setUp(self):
        self.clock = 0.0
        self.looks = 0
        self.answer: object = None

    def look(self):
        self.looks += 1
        if isinstance(self.answer, Exception):
            raise self.answer
        return self.answer

    def schedule(self) -> up.Schedule:
        return up.Schedule(self.look, now=lambda: self.clock)

    def test_never_looks_while_a_task_is_running(self):
        schedule = self.schedule()
        for _ in range(10):
            self.clock += 600
            self.assertFalse(schedule.tick(busy=True))
        self.assertEqual(self.looks, 0)
        schedule.tick(busy=False)
        self.assertEqual(self.looks, 1)

    def test_looks_again_after_six_hours_or_at_once_when_asked(self):
        schedule = self.schedule()
        schedule.tick(busy=False)
        self.clock += up.CHECK_EVERY_S - 1
        schedule.tick(busy=False)
        self.assertEqual(self.looks, 1)
        schedule.tick(busy=False, asked=True)  # OCADE said this build is too old
        self.assertEqual(self.looks, 2)
        self.clock += up.CHECK_EVERY_S
        schedule.tick(busy=False)
        self.assertEqual(self.looks, 3)

    def test_a_failed_look_is_said_and_tried_again_sooner(self):
        self.answer = OSError("no network")
        schedule = self.schedule()
        self.assertFalse(schedule.tick(busy=False))
        self.assertIn("no network", schedule.last_error)
        self.clock += up.RETRY_AFTER_S - 1
        schedule.tick(busy=False)
        self.assertEqual(self.looks, 1)
        self.answer = None
        self.clock += 1
        schedule.tick(busy=False)
        self.assertEqual((self.looks, schedule.last_error), (2, None))

    def test_a_staged_build_starts_only_after_two_idle_minutes(self):
        self.answer = "2.0.0"
        schedule = self.schedule()
        self.assertFalse(schedule.tick(busy=False))      # staged just now
        self.clock += up.IDLE_BEFORE_RESTART_S - 1
        self.assertFalse(schedule.tick(busy=False))
        self.clock += 30
        self.assertFalse(schedule.tick(busy=True))       # a task began: the wait starts over
        self.clock += up.IDLE_BEFORE_RESTART_S + 1
        self.assertFalse(schedule.tick(busy=True))       # still working, however long
        self.assertFalse(schedule.tick(busy=False))      # idle from now
        self.clock += up.IDLE_BEFORE_RESTART_S
        self.assertTrue(schedule.tick(busy=False))
        self.assertEqual(self.looks, 1)                  # staged once, not fetched again


class AgentStartTest(unittest.TestCase):
    """How the running agent uses the updater: what counts as a start, and what as healthy."""

    def setUp(self):
        import ocade_agent
        self.agent_module = ocade_agent
        self.root = Path(tempfile.mkdtemp())
        self.exe = self.root / "versions" / "1.0.0" / PROGRAM
        self.exe.parent.mkdir(parents=True)
        self.exe.write_text("healthy")

    def fake_agent(self, **state):
        import threading
        return type("A", (), {"stop": threading.Event(), "state": dict(state)})()

    def layout(self) -> dict:
        return json.loads((self.root / "current.json").read_text())

    def test_a_build_that_stays_up_is_healthy_without_ever_reaching_ocade(self):
        """Two logins with no network must not roll a good build back."""
        up.adopt(self.root, "1.0.0")
        for _ in range(3):
            up.launch_target(self.root)
            agent = self.fake_agent(reached=False, offline=True)
            with mock.patch.object(up, "UPDATE_PUBLIC_KEY", None):
                self.agent_module._watch_health_and_updates(agent, self.root, "https://ocade.test",
                                                            started_ok_s=0.01)
            self.assertEqual(self.layout()["failedStarts"], 0)
        self.assertEqual(self.layout()["current"], "1.0.0")

    def test_a_build_that_ends_before_it_has_started_counts_as_a_failed_start(self):
        up.adopt(self.root, "1.0.0")
        up.launch_target(self.root)
        agent = self.fake_agent()
        agent.stop.set()  # its work loop died at once
        self.agent_module._watch_health_and_updates(agent, self.root, "https://ocade.test",
                                                    started_ok_s=5)
        self.assertEqual(self.layout()["failedStarts"], 1)

    def test_the_launcher_counts_one_start_not_two(self):
        """The build the launcher hands over to must not count the same start again."""
        newer = self.root / "versions" / "2.0.0" / PROGRAM
        newer.parent.mkdir()
        newer.write_text("healthy")
        up.adopt(self.root, "1.0.0")
        up._write_layout(self.root, {"current": "2.0.0", "previous": "1.0.0", "failedStarts": 0,
                                     "installed": "1.0.0"})
        handed = {}

        def fake_exec(path, argv):
            handed["to"] = path
            raise SystemExit  # execv never returns

        with mock.patch.object(sys, "executable", str(self.exe)), \
                mock.patch.object(os, "execv", fake_exec), \
                mock.patch.dict(os.environ, {}, clear=False):
            with self.assertRaises(SystemExit):
                self.agent_module._run_current_build(self.root)
            self.assertEqual(Path(handed["to"]).parent.name, "2.0.0")
            # Now as the new build, started by that hand-over.
            with mock.patch.object(sys, "executable", str(newer)):
                self.agent_module._run_current_build(self.root)
        self.assertEqual(self.layout()["failedStarts"], 1)

    def test_a_staged_update_restarts_an_idle_agent_and_never_a_working_one(self):
        up.adopt(self.root, "1.0.0")
        clock = {"now": 0.0}

        def fake_check(server, root, current):
            return "2.0.0"

        for busy, restarts in ((True, False), (False, True)):
            agent = self.fake_agent(busy=busy)
            ticks = {"n": 0}
            real_wait = agent.stop.wait

            def wait(timeout, real_wait=real_wait, ticks=ticks, agent=agent):
                ticks["n"] += 1
                clock["now"] += 100  # each pass of the loop is 100 seconds later
                if ticks["n"] > 6:
                    agent.stop.set()
                return real_wait(0)

            agent.stop.wait = wait
            with mock.patch.object(up, "UPDATE_PUBLIC_KEY", "set"), \
                    mock.patch.object(up, "check", fake_check), \
                    mock.patch.object(up.time, "monotonic", lambda: clock["now"]):
                self.agent_module._watch_health_and_updates(agent, self.root, "https://ocade.test",
                                                            started_ok_s=0, every_s=0)
            self.assertEqual(bool(agent.state.get("restart")), restarts, f"busy={busy}")


if __name__ == "__main__":
    unittest.main()
