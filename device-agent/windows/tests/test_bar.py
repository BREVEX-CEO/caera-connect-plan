"""The floating bar (plan 14F.4): its state comes only from steps the companion really runs; an
agent marker only from a point a click reported; what the person types is delivered once, kept
through an outage, and dropped when unreadable; the collapsed line counts active agents honestly."""

import json
import tempfile
import unittest
import uuid
from contextlib import closing
from pathlib import Path
from unittest.mock import patch

import anyio

from ocade_agent.agent import Agent
from ocade_agent.bar import BarState, pending_instructions, queue_instruction, summary
from ocade_agent.journal import Journal


class BarStateTest(unittest.TestCase):
    def test_state_follows_the_steps_that_run(self):
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory)
            bar = BarState(home)
            bar.task_seen({"id": "t", "status": "running"})
            bar.started(0, {"operation": "ui.click_point", "arguments": {"window": {"hwnd": 42, "exe": "x.exe"}}})
            bar.started(2, {"operation": "fs.write_text", "arguments": {}})
            state = json.loads((home / "bar.json").read_text())
            self.assertEqual([a["lane"] for a in state["agents"]], [0, 2])
            self.assertEqual(state["window"]["hwnd"], 42)
            self.assertEqual(summary(state), "2 agents working · Clicking in an app")
            bar.finished(0, {"operation": "ui.click_point"}, {"evidence": {"clicked": [10, 20]}})
            bar.finished(2, {"operation": "fs.write_text"}, {"evidence": {"clicked": [1, 1]}})
            state = json.loads((home / "bar.json").read_text())
            self.assertEqual([(m["lane"], m["x"], m["y"]) for m in state["marks"]], [(0, 10, 20)],
                             "a marker only where a click reported its point")
            self.assertEqual(summary(state), "Planning the next step")
            bar.task_seen({"id": "next-task", "status": "running"})
            state = json.loads((home / "bar.json").read_text())
            self.assertEqual(state["marks"], [])
            self.assertIsNone(state["window"])
            bar.task_seen({"id": "t", "status": "completed"})
            self.assertIsNone(json.loads((home / "bar.json").read_text())["task"], "a finished task hides the bar")


class InstructionTest(unittest.TestCase):
    def test_typed_instructions_are_delivered_once_and_kept_through_an_outage(self):
        with tempfile.TemporaryDirectory() as directory, closing(Journal(Path(directory) / "j.sqlite")) as journal:
            home = Path(directory)
            task_id = str(uuid.uuid4())
            with patch("ocade_agent.bar.time.time_ns", return_value=1_800_000_000_000_000_000):
                queue_instruction(home, "  Use the blue logo ", None, task_id)
                queue_instruction(home, "Smaller", 1, task_id)
            (home / "instructions" / "0-broken.json").write_text("{not json")
            with self.assertRaises(ValueError):
                queue_instruction(home, "   ", None, task_id)
            with self.assertRaises(ValueError):
                queue_instruction(home, "x", 9, task_id)

            class Device:
                def __init__(self):
                    self.home, self.sent, self.status = home, [], 503

                def request(self, payload):
                    self.sent.append(payload)
                    return self.status, {}

            device = Device()
            agent = Agent(device, journal, object(), home / "STOP")
            anyio.run(agent.deliver_instructions)
            self.assertEqual(len(device.sent), 1, "an outage stops the round, nothing is dropped")
            self.assertEqual(len(pending_instructions(home)), 2, "the unreadable file is dropped, never sent")
            device.status = 200
            anyio.run(agent.deliver_instructions)
            sent = [p for p in device.sent if p["op"] == "instruct"]
            self.assertEqual([p["text"] for p in sent[1:]], ["Use the blue logo", "Smaller"])
            self.assertEqual(sent[0]["clientId"], sent[1]["clientId"], "a retry is the same instruction")
            self.assertTrue(all(payload["taskId"] == task_id for payload in sent))
            self.assertEqual(sent[2]["lane"], 1)
            self.assertEqual(pending_instructions(home), [])


class PointTest(unittest.TestCase):
    def test_a_pointed_region_is_kept_only_in_the_jarvis_folder_and_asked_about(self):
        from PIL import Image

        from ocade_agent.bar import point_instruction, save_pointed

        with tempfile.TemporaryDirectory() as directory:
            home, workspace = Path(directory, "home"), Path(directory, "ws")
            home.mkdir()
            workspace.mkdir()
            (home / "device.json").write_text(json.dumps({"workspace": str(workspace)}))
            path = save_pointed(home, Image.new("RGB", (20, 10), "red"), now=0)
            self.assertTrue(path.startswith("OCADE output/pointed/") and path.endswith(".png"))
            with Image.open(workspace / path) as pointed:
                self.assertEqual(pointed.size, (20, 10))
            text = point_instruction(path, "")
            self.assertIn(path, text)
            self.assertIn("media.preview", text)


if __name__ == "__main__":
    unittest.main()
