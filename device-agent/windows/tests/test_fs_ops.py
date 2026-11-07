"""Typed file management (W3, D17) through the gateway and the real files worker.

Copy, move/rename, folders, Trash and attributes replace confirmed shell commands for
ordinary organising. Each must stay inside the workspace, never replace anything, keep
the person's originals and say exactly what changed.
"""

import json
import os
import stat
import sys
import tempfile
import unittest
import unittest.mock
from pathlib import Path

import anyio

from ocade_agent.gateway import Gateway
from ocade_agent.sandbox import sha256
from tests.test_gateway import intent


class TypedFileOperations(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp())
        self.home = Path(tempfile.mkdtemp())  # the worker's Trash lives here on Linux
        (self.root / "notes.txt").write_text("keep me")
        (self.root / "photos").mkdir()
        (self.root / "photos" / "a.jpg").write_bytes(b"\xff\xd8 not really a photo")
        originals = self.root / "OCADE output" / "originals"
        originals.mkdir(parents=True)
        (originals / "notes.txt.20261104T000000Z-00.txt").write_text("earlier")

    def run_all(self, intents):
        saved = os.environ.get("HOME")
        os.environ["HOME"] = str(self.home)

        async def go():
            async with Gateway(str(self.root)) as gateway:
                return [await gateway.run(i, gateway.epoch) for i in intents]

        try:
            return anyio.run(go)
        finally:
            if saved is None:
                os.environ.pop("HOME", None)
            else:
                os.environ["HOME"] = saved

    def test_copy_makes_a_new_output_and_leaves_the_source(self):
        before = sha256(self.root / "notes.txt")
        copied, again, outside = self.run_all([
            intent("fs.manage", {"action": "copy", "path": "notes.txt", "to": "OCADE output/copy.txt"}),
            intent("fs.manage", {"action": "copy", "path": "notes.txt", "to": "OCADE output/copy.txt"}),
            intent("fs.manage", {"action": "copy", "path": "../etc/passwd", "to": "OCADE output/x.txt"}),
        ])
        self.assertEqual(copied["status"], "observed", copied)
        self.assertTrue(copied["evidence"]["matches"])
        self.assertEqual(sha256(self.root / "OCADE output" / "copy.txt"), before)
        self.assertEqual(sha256(self.root / "notes.txt"), before)
        self.assertEqual(again["errorCode"], "output_exists")
        self.assertEqual(outside["errorCode"], "path_outside_workspace")

    def test_move_organises_without_replacing_anything(self):
        photo = sha256(self.root / "photos" / "a.jpg")
        (self.root / "taken.txt").write_text("already here")
        folder, moved, taken, into_itself, original, root, escape = self.run_all([
            intent("fs.manage", {"action": "mkdir", "path": "photos/2026"}),
            intent("fs.manage", {"action": "move", "path": "photos/a.jpg", "to": "photos/2026/a.jpg"}),
            intent("fs.manage", {"action": "move", "path": "notes.txt", "to": "taken.txt"}),
            intent("fs.manage", {"action": "move", "path": "photos", "to": "photos/2026/photos"}),
            intent("fs.manage", {"action": "move", "path": "OCADE output/originals/notes.txt.20261104T000000Z-00.txt",
                               "to": "elsewhere.txt"}),
            intent("fs.manage", {"action": "move", "path": "OCADE output", "to": "renamed"}),
            intent("fs.manage", {"action": "move", "path": "notes.txt", "to": "../notes.txt"}),
        ])
        self.assertEqual((folder["status"], folder["evidence"]["created"]), ("observed", True))
        self.assertEqual(moved["status"], "observed", moved)
        self.assertEqual(moved["evidence"]["from"], "photos/a.jpg")
        self.assertEqual(moved["evidence"]["to"], "photos/2026/a.jpg")
        self.assertTrue(moved["evidence"]["matches"])
        self.assertEqual(sha256(self.root / "photos" / "2026" / "a.jpg"), photo)
        self.assertFalse((self.root / "photos" / "a.jpg").exists())
        self.assertEqual(taken["errorCode"], "destination_exists")
        self.assertEqual((self.root / "taken.txt").read_text(), "already here")
        self.assertEqual((self.root / "notes.txt").read_text(), "keep me")
        self.assertEqual(into_itself["errorCode"], "into_itself")
        self.assertEqual(original["errorCode"], "original_kept")
        self.assertEqual(root["errorCode"], "workspace_root")
        self.assertEqual(escape["errorCode"], "path_outside_workspace")
        for refused in (taken, into_itself, original, root, escape):
            self.assertEqual((refused["status"], refused["maybeChanged"]), ("not_applied", False), refused)

    def test_trash_is_recoverable_and_never_an_original(self):
        trashed, gone, original = self.run_all([
            intent("fs.manage", {"action": "trash", "path": "notes.txt"}),
            intent("fs.manage", {"action": "trash", "path": "notes.txt"}),
            intent("fs.manage", {"action": "trash", "path": "OCADE output/originals/notes.txt.20261104T000000Z-00.txt"}),
        ])
        self.assertEqual(trashed["status"], "observed", trashed)
        self.assertFalse((self.root / "notes.txt").exists())
        if sys.platform.startswith("linux"):  # the freedesktop Trash under the worker's HOME
            kept = list((self.home / ".local" / "share" / "Trash" / "files").iterdir())
            self.assertEqual([p.read_text() for p in kept], ["keep me"])
        self.assertEqual(gone["errorCode"], "not_found")
        self.assertEqual(original["errorCode"], "original_kept")
        self.assertTrue(any((self.root / "OCADE output" / "originals").iterdir()))

    def test_attributes_change_and_report_how_to_undo(self):
        script = self.root / "run.sh"
        script.write_text("#!/bin/sh\necho ok\n")
        os.chmod(script, 0o644)
        executable, locked, unlocked, nothing = self.run_all([
            intent("fs.manage", {"action": "set_attributes", "path": "run.sh", "executable": True}),
            intent("fs.manage", {"action": "set_attributes", "path": "run.sh", "readOnly": True}),
            intent("fs.manage", {"action": "set_attributes", "path": "run.sh", "readOnly": False}),
            intent("fs.manage", {"action": "set_attributes", "path": "photos", "readOnly": True}),
        ])
        self.assertEqual(executable["status"], "observed", executable)
        if os.name == "posix":
            self.assertEqual(executable["evidence"]["modeBefore"], "0o644")
            self.assertTrue(executable["evidence"]["executable"])
            self.assertTrue(script.stat().st_mode & stat.S_IXUSR)
        self.assertTrue(locked["evidence"]["readOnly"])
        self.assertFalse(unlocked["evidence"]["readOnly"])
        self.assertTrue(script.stat().st_mode & stat.S_IWUSR)
        self.assertEqual(nothing["errorCode"], "not_a_file")


class Diagnostics(unittest.TestCase):
    """Read-only system facts; never a secret value, nothing changed."""

    def test_processes_environment_and_refusals(self):
        root = tempfile.mkdtemp()

        async def go():
            async with Gateway(root) as gateway:
                return [await gateway.run(intent("system.diagnose", arguments), gateway.epoch) for arguments in (
                    {"topic": "processes", "filter": "python"},
                    {"topic": "environment"},
                    {"topic": "crashes"},
                    {"topic": "nonsense"},
                )]

        processes, environment, crashes, nonsense = anyio.run(go)
        self.assertEqual(processes["status"], "observed", processes)
        self.assertGreater(processes["evidence"]["count"], 0)
        self.assertTrue(all("python" in line.lower() for line in processes["evidence"]["lines"]))
        self.assertIn("PATH", [name.upper() for name in environment["evidence"]["names"]])
        self.assertNotIn("=", " ".join(environment["evidence"]["names"]))
        self.assertTrue(environment["evidence"]["path"])
        self.assertIn(crashes["status"], ("observed", "not_applied"), crashes)
        self.assertEqual(nonsense["errorCode"], "invalid_intent")


    def test_missing_path_folders_and_registry_keys_are_named_read_only(self):
        from unittest.mock import patch

        from ocade_agent import office_worker

        real, gone = tempfile.mkdtemp(), os.path.join(tempfile.mkdtemp(), "uninstalled-tool")
        with patch.dict(os.environ, {"PATH": os.pathsep.join([real, gone])}):
            found = office_worker.system_diagnose(topic="environment")
        self.assertEqual(found["missingPathEntries"], [gone], "a removed program folder is named")
        if os.name == "nt":
            present = office_worker.system_diagnose(topic="registry", filter="HKCU\\Software")
            self.assertTrue(present["exists"] and present["subkeys"], present)
            absent = office_worker.system_diagnose(topic="registry", filter="HKCU\\Software\\OCADE-missing-key-test")
            self.assertEqual(absent, {"topic": "registry", "key": "HKCU\\Software\\OCADE-missing-key-test", "exists": False})
        refused = office_worker.system_diagnose(topic="registry", filter="HKCR\\anything")
        self.assertEqual(refused["refused"], "diagnostic_unavailable" if os.name != "nt" else "invalid_registry_key")


class LongTextReads(unittest.TestCase):
    def test_a_long_file_is_read_in_parts(self):
        from ocade_agent import office_worker

        root = Path(tempfile.mkdtemp())
        # Bytes, so the file has the same 22,000 characters on Windows (no CRLF translation).
        (root / "log.txt").write_bytes("".join(f"line {n:05d}\n" for n in range(2000)).encode())
        with unittest.mock.patch.object(office_worker, "WORKSPACE", str(root)):
            first = office_worker.fs_read_text(path="log.txt")
            second = office_worker.fs_read_text(path="log.txt", offset=first["nextOffset"])
            last = office_worker.fs_read_text(path="log.txt", offset=second["nextOffset"])
        self.assertEqual((first["truncated"], first["nextOffset"], first["totalCharacters"]), (True, 8000, 22000))
        self.assertEqual(second["offset"], 8000)
        self.assertFalse(last["truncated"])
        self.assertNotIn("nextOffset", last)
        self.assertEqual(first["text"] + second["text"] + last["text"], (root / "log.txt").read_bytes().decode())


class BrowserDiscovery(unittest.TestCase):
    def test_installed_browsers_are_found_not_assumed(self):
        from unittest.mock import patch

        from ocade_agent import discovery

        listed = discovery.browsers()
        self.assertTrue(all(set(b) == {"name", "path", "profiles"} for b in listed), listed)
        if sys.platform.startswith("linux"):
            folder, home = Path(tempfile.mkdtemp()), Path(tempfile.mkdtemp())
            for name in ("brave-browser", "firefox"):
                (folder / name).write_text("#!/bin/sh\n")
                (folder / name).chmod(0o755)
            with patch.dict(os.environ, {"PATH": str(folder), "HOME": str(home)}):
                self.assertEqual(discovery.browsers(), [{"name": "Firefox", "path": str(folder / "firefox"), "profiles": []},
                                                        {"name": "Brave", "path": str(folder / "brave-browser"),
                                                         "profiles": []}])
                brave = home / ".config/BraveSoftware/Brave-Browser"
                brave.mkdir(parents=True)
                (brave / "Local State").write_text(json.dumps({"profile": {"info_cache": {
                    "Default": {"name": "Alex Personal", "user_name": "alex@example.com"}, "Profile 2": {"name": "Work"}}}}))
                firefox = home / ".mozilla/firefox"
                firefox.mkdir(parents=True)
                (firefox / "profiles.ini").write_text("[General]\nVersion=2\n[Profile0]\nName=default-release\n"
                                                      "Path=abc.default-release\n[Install4F96]\nDefault=abc\n")
                found = discovery.browsers()
                self.assertEqual([b["profiles"] for b in found], [["Profile0"], ["Default", "Profile 2"]])  # section IDs, never chosen names
                self.assertNotIn("alex", json.dumps(found).lower())  # names the person chose stay private
            with patch.dict(os.environ, {"PATH": str(Path(tempfile.mkdtemp()))}):
                self.assertEqual(discovery.browsers(), [])


if __name__ == "__main__":
    unittest.main()
