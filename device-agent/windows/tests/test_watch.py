"""Watched folders (REPO-61/71): files already there are the starting point; a new file is
reported once it has settled, exactly once; temporary, hidden and outside files never count;
an outage keeps the file for the next look; no file content is read."""

import os
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

import anyio

from ocade_agent.agent import Agent
from ocade_agent.journal import Journal
from ocade_agent.watch import Watcher, inside


class WatcherTest(unittest.TestCase):
    def test_new_settled_files_are_reported_once(self):
        with tempfile.TemporaryDirectory() as directory:
            workspace, home = Path(directory, "ws"), Path(directory, "home")
            (workspace / "Invoices").mkdir(parents=True)
            home.mkdir()
            (workspace / "Invoices" / "old.pdf").write_bytes(b"x")
            watcher = Watcher(workspace, home)
            watcher.set_rules([{"id": "w1", "folder": "Invoices"}, {"id": "w2", "folder": "../"}], 0)
            self.assertEqual(watcher.look(1), [], "the first look is the starting point")
            (workspace / "Invoices" / "new.pdf").write_bytes(b"abc")
            (workspace / "Invoices" / "big.crdownload").write_bytes(b"abc")
            (workspace / "Invoices" / ".hidden").write_bytes(b"abc")
            self.assertEqual(watcher.look(2), [], "a new file settles first")
            events = watcher.look(3)
            self.assertEqual([e["file"] for e in events], ["new.pdf"])
            self.assertEqual(watcher.look(4), [e for e in events], "unreported: offered again")
            watcher.reported(events[0])
            self.assertEqual(watcher.look(5), [], "reported once")
            # A restart keeps what is known.
            self.assertEqual(Watcher(workspace, home).state["w1"]["known"].keys() >= {"new.pdf", "old.pdf"}, True)

    def test_a_folder_outside_the_jarvis_folder_is_never_listed(self):
        with tempfile.TemporaryDirectory() as directory:
            workspace = Path(directory, "ws")
            workspace.mkdir()
            outside = Path(directory, "secret")
            outside.mkdir()
            self.assertIsNone(inside(workspace, "../secret"))
            if hasattr(os, "symlink"):
                try:
                    os.symlink(outside, workspace / "link", target_is_directory=True)
                except OSError:
                    return
                self.assertIsNone(inside(workspace, "link"), "a link elsewhere is outside")


class AgentWatchTest(unittest.TestCase):
    def test_the_agent_asks_for_rules_and_reports_each_file_once(self):
        with tempfile.TemporaryDirectory() as directory, closing(Journal(Path(directory) / "j.sqlite")) as journal:
            workspace, home = Path(directory, "ws"), Path(directory, "home")
            (workspace / "In").mkdir(parents=True)
            home.mkdir()

            class Device:
                def __init__(self):
                    self.home, self.sent = home, []

                def request(self, payload):
                    self.sent.append(payload)
                    if payload["op"] == "watches":
                        return 200, {"watches": [{"id": "w1", "folder": "In"}]}
                    return 200, {"watch": "scheduled"}

            class Gateway:
                epoch = 0

                def __init__(self):
                    self.workspace = str(workspace)

            device = Device()
            agent = Agent(device, journal, Gateway(), home / "STOP")
            for step in range(4):
                if step == 1:
                    (workspace / "In" / "a.txt").write_text("hello")
                agent.watcher.looked_at = -100.0
                anyio.run(agent.watch_folders)
            events = [p for p in device.sent if p["op"] == "watch_event"]
            self.assertEqual([e["file"] for e in events], ["a.txt"])
            self.assertEqual(sum(p["op"] == "watches" for p in device.sent), 1, "rules are not asked every look")


if __name__ == "__main__":
    unittest.main()
