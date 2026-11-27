"""system.diagnose `protection`: where a workspace file came from, read-only (plan W9 item 113).

The parsers are exercised with the exact text each platform stores; the Linux path reads a real
extended attribute when the filesystem allows one. Nothing is removed or bypassed.
"""

import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from ocade_agent.sandbox import Refused

from ocade_agent import office_worker

root = tempfile.mkdtemp(prefix="ocade-protection-")


class Parsers(unittest.TestCase):
    def test_a_windows_zone_identifier_gives_the_zone_and_only_hosts(self):
        text = ("[ZoneTransfer]\r\nZoneId=3\r\nReferrerUrl=https://example.test/download?token=SECRET\r\n"
                "HostUrl=https://cdn.example.test/app.exe?sig=SECRET2\r\n")
        found = office_worker._zone_identifier(text)["markOfTheWeb"]
        self.assertEqual(found, {"zoneId": 3, "zone": "internet", "downloadedFrom": "cdn.example.test",
                                 "referrer": "example.test"})
        self.assertNotIn("SECRET", str(found))
        self.assertEqual(office_worker._zone_identifier("[ZoneTransfer]\r\nZoneId=zero")["markOfTheWeb"], None)
        self.assertEqual(office_worker._zone_identifier("")["markOfTheWeb"], None)
        self.assertEqual(office_worker._zone_identifier("ZoneId=9")["markOfTheWeb"]["zone"], "unknown")

    def test_a_macos_quarantine_flag_gives_flags_time_and_application(self):
        found = office_worker._quarantine_flag("0083;5f4e1c2a;Safari;A1B2C3D4-0000-0000-0000-000000000000\n")
        self.assertEqual(found["quarantine"], {"flags": "0083", "application": "Safari",
                                                "at": "2020-09-01T10:02:18Z"})
        for bad in ("", "nonsense", "zzzz;5f4e1c2a;Safari", "0083"):
            self.assertIsNone(office_worker._quarantine_flag(bad)["quarantine"], bad)
        self.assertNotIn("at", office_worker._quarantine_flag("0083;zz;Safari;u")["quarantine"])

    def test_only_a_host_is_ever_kept_from_an_address(self):
        self.assertEqual(office_worker._host_of("https://user:pw@host.test:8443/a/b?c=d"), "host.test")
        self.assertIsNone(office_worker._host_of("not an address"))
        self.assertIsNone(office_worker._host_of("http://[bad"))


class Facts(unittest.TestCase):
    def setUp(self):
        # Other test modules may already have imported the worker with their own workspace.
        workspace = patch.object(office_worker, "WORKSPACE", root)
        workspace.start()
        self.addCleanup(workspace.stop)
        self.file = Path(root) / f"download-{os.urandom(4).hex()}.bin"
        self.file.write_bytes(b"x")

    def test_a_file_outside_the_workspace_or_missing_is_refused(self):
        for path in ("../outside.txt", "missing-" + os.urandom(3).hex(), ""):
            with self.subTest(path=path), self.assertRaises(Refused):
                office_worker._file_protection(path)

    @unittest.skipUnless(sys.platform.startswith("linux") and hasattr(os, "setxattr"), "needs Linux extended attributes")
    def test_linux_reports_the_host_a_download_recorded_and_nothing_else(self):
        try:
            os.setxattr(self.file, "user.xdg.origin.url", b"https://files.example.test/path?token=SECRET")
        except OSError:
            self.skipTest("this filesystem keeps no user extended attributes")
        facts = office_worker._file_protection(self.file.name)
        self.assertEqual(facts["origin"], {"downloadedFrom": "files.example.test"})
        self.assertNotIn("SECRET", str(facts))
        self.assertIn("no mark is removed", facts["note"])
        self.assertTrue(os.getxattr(self.file, "user.xdg.origin.url"), "the mark is still there")

    def test_an_unmarked_file_says_so(self):
        facts = office_worker._file_protection(self.file.name)
        self.assertEqual(facts["topic"], "protection")
        self.assertEqual(facts["path"], self.file.name)
        self.assertTrue(any(facts.get(key) is None for key in ("origin", "markOfTheWeb", "quarantine")))


if __name__ == "__main__":
    unittest.main()
