"""system.inspect asks the platform what a program is, instead of trusting a name on PATH (plan W9 item 100).

The package facts are compared with the package manager asked a second, independent way.
"""

import os
import plistlib
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from unittest.mock import patch

from ocade_agent import office_worker


class PlatformFacts(unittest.TestCase):
    def setUp(self):
        # Other test modules may already have imported the worker with their own (or no) workspace.
        workspace = patch.object(office_worker, "WORKSPACE", tempfile.gettempdir())
        workspace.start()
        self.addCleanup(workspace.stop)

    @unittest.skipUnless(sys.platform.startswith("linux") and shutil.which("dpkg-query"), "needs a dpkg system")
    def test_a_program_is_attributed_to_the_package_dpkg_says_owns_it(self):
        program = os.path.realpath(shutil.which("sh") or "/bin/sh")
        owned = subprocess.run(["dpkg", "-S", program], capture_output=True, text=True)
        if owned.returncode != 0:
            self.skipTest("the shell on this machine is not a dpkg package")
        name = owned.stdout.split(":", 1)[0].split(",")[0].strip()
        version = subprocess.run(["dpkg-query", "-W", "-f=${Version}", name], capture_output=True, text=True).stdout
        facts = office_worker._package_owner(program)
        self.assertEqual(facts, {"package": {"manager": "dpkg", "name": name, "version": version}})

    @unittest.skipUnless(sys.platform.startswith("linux") and shutil.which("dpkg-query"), "needs a dpkg system")
    def test_a_file_no_package_owns_has_no_package_facts(self):
        with tempfile.NamedTemporaryFile(prefix="ocade-own-", delete=False) as handle:
            path = handle.name
        try:
            self.assertEqual(office_worker._package_owner(path), {})
        finally:
            os.unlink(path)

    def test_pacman_and_apk_owners_are_read_from_their_exact_output(self):
        self.assertEqual(
            office_worker._owner_from_pacman("/usr/bin/sh is owned by bash 5.2.015-1\n", "/usr/bin/sh"),
            {"package": {"manager": "pacman", "name": "bash", "version": "5.2.015-1"}},
        )
        for said in ("error: No package owns /usr/bin/sh", "/other is owned by bash 5.2-1", "", "/usr/bin/sh is owned by bash"):
            self.assertEqual(office_worker._owner_from_pacman(said, "/usr/bin/sh"), {}, said)
        self.assertEqual(
            office_worker._owner_from_apk("/bin/busybox is owned by busybox-1.36.1-r5\n"),
            {"package": {"manager": "apk", "name": "busybox", "version": "1.36.1-r5"}},
        )
        self.assertEqual(
            office_worker._owner_from_apk("/usr/bin/x is owned by ca-certificates-bundle-20230506-r0"),
            {"package": {"manager": "apk", "name": "ca-certificates-bundle", "version": "20230506-r0"}},
        )
        for said in ("ERROR: /tmp/x: Could not find owner package", "", "/bin/x is owned by nover"):
            self.assertEqual(office_worker._owner_from_apk(said), {}, said)

    def test_a_macos_bundle_reports_the_version_its_info_plist_records(self):
        with tempfile.TemporaryDirectory() as folder:
            contents = Path(folder) / "Fixture.app" / "Contents"
            (contents / "MacOS").mkdir(parents=True)
            (contents / "Info.plist").write_bytes(plistlib.dumps({"CFBundleShortVersionString": "4.7.1"}))
            program = contents / "MacOS" / "fixture"
            program.write_bytes(b"\x00")
            self.assertEqual(office_worker._bundle_version(str(program)), {"bundleVersion": "4.7.1"})
            (contents / "Info.plist").write_bytes(b"not a plist")
            self.assertEqual(office_worker._bundle_version(str(program)), {})
            self.assertEqual(office_worker._bundle_version(str(Path(folder) / "plain")), {})

    def test_system_inspect_returns_the_platform_facts_with_the_path(self):
        shell = shutil.which("sh") or shutil.which("cmd") or sys.executable
        reported = office_worker.system_inspect(programs=[Path(shell).name])
        entry = reported["programs"][Path(shell).name]
        self.assertTrue(entry["path"])
        if sys.platform.startswith("linux") and shutil.which("dpkg-query"):
            owned = subprocess.run(["dpkg", "-S", os.path.realpath(entry["path"])], capture_output=True)
            self.assertEqual("package" in entry, owned.returncode == 0)


if __name__ == "__main__":
    unittest.main()
