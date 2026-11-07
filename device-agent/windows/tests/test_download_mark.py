"""Downloads keep the system's came-from-the-internet mark (threat 170, requirement 113).

The mark lets SmartScreen and Gatekeeper judge the file when the person opens it. Platform
branches are exercised through their real calls; only the platform name is substituted.
"""

import subprocess
import tempfile
import unittest
from contextlib import asynccontextmanager
from pathlib import Path
from unittest.mock import patch

import anyio

from ocade_agent import web_worker


class DownloadMark(unittest.TestCase):
    def setUp(self):
        self.target = Path(tempfile.mkdtemp()) / "setup.exe"
        self.target.write_bytes(b"MZ")

    def test_windows_writes_an_internet_zone_identifier_with_only_the_origin(self):
        with patch.object(web_worker.sys, "platform", "win32"):
            self.assertEqual(web_worker.mark_downloaded(self.target, "https://downloads.example.test"), "zone_identifier")
        # On NTFS this is the file's alternate stream; elsewhere the same name is an ordinary file.
        mark = Path(f"{self.target}:Zone.Identifier").read_bytes()
        self.assertEqual(mark, b"[ZoneTransfer]\r\nZoneId=3\r\nHostUrl=https://downloads.example.test\r\n")

    def test_macos_sets_the_quarantine_attribute(self):
        calls = []
        with patch.object(web_worker.sys, "platform", "darwin"), \
                patch.object(web_worker.shutil, "which", lambda name: "xattr-tool" if name == "xattr" else None), \
                patch.object(web_worker.subprocess, "run", lambda argv, **kwargs: calls.append(argv)):
            self.assertEqual(web_worker.mark_downloaded(self.target, "https://example.test"), "quarantine")
        [argv] = calls
        self.assertEqual(argv[:3], ["xattr-tool", "-w", "com.apple.quarantine"])
        self.assertRegex(argv[3], r"^0081;[0-9a-f]+;OCADE;$")
        self.assertEqual(argv[4], str(self.target))

    def test_a_mark_that_cannot_be_written_is_reported_not_a_failed_download(self):
        def refuse(argv, **kwargs):
            raise subprocess.CalledProcessError(1, argv)

        with patch.object(web_worker.sys, "platform", "darwin"), \
                patch.object(web_worker.shutil, "which", lambda name: "xattr-tool"), \
                patch.object(web_worker.subprocess, "run", refuse):
            self.assertEqual(web_worker.mark_downloaded(self.target, "https://example.test"), "unavailable")
        self.assertEqual(self.target.read_bytes(), b"MZ")


class Download:
    def __init__(self, url, staged):
        self.url, self.staged, self.suggested_filename, self.cancelled = url, staged, "setup.exe", False

    async def path(self):
        return self.staged

    async def cancel(self):
        self.cancelled = True


class Page:
    url = "https://site.example.test/"

    def __init__(self, download):
        self.download = download

    def is_closed(self):
        return False

    @asynccontextmanager
    async def expect_download(self, timeout):
        class Pending:
            pass

        pending = Pending()
        yield pending

        async def value():
            return self.download

        pending.value = value()


class Link:
    async def click(self):
        pass


class DownloadOrigin(unittest.TestCase):
    def download(self, url, platform="linux"):
        root = Path(tempfile.mkdtemp())
        staged = root / "staged"
        staged.write_bytes(b"MZ payload")
        download = Download(url, staged)
        entry = {"page": Page(download), "origin": ("https", "site.example.test", 443), "site": "s1"}

        async def link(*args):
            return Link()

        with patch.dict(web_worker._pages, {"p1": entry}, clear=True), \
                patch.object(web_worker, "_one", link), patch.object(web_worker, "WORKSPACE", str(root)), \
                patch.object(web_worker.sys, "platform", platform):
            result = anyio.run(web_worker.web_download, {"id": "p1", "site": "s1"}, "", "OCADE output/setup.exe")
        return result, download, root / "OCADE output" / "setup.exe"

    def test_a_download_served_from_another_site_is_cancelled_and_never_saved(self):
        result, download, saved = self.download("https://elsewhere.example.test/setup.exe")
        self.assertEqual(result, {"refused": "download_off_origin", "maybeChanged": True})
        self.assertTrue(download.cancelled)
        self.assertFalse(saved.exists())

    def test_a_same_site_download_is_saved_with_its_origin(self):
        result, download, saved = self.download("https://site.example.test/files/setup.exe", "win32")
        self.assertEqual(saved.read_bytes(), b"MZ payload")
        self.assertEqual((result["magic"], result["internetMark"]), (b"MZ payload"[:8].hex(), "zone_identifier"))
        self.assertIn(b"HostUrl=https://site.example.test:443\r\n", Path(f"{saved}:Zone.Identifier").read_bytes())


if __name__ == "__main__":
    unittest.main()
