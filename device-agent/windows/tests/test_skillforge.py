"""SkillForge's recorder (plan 28.2.1): the person's presses and final field values in ONE window,
as ordered steps; presses outside the window and into text boxes are not steps; a protected field
is recorded only as "the person typed here", never its value; the recording is bounded. Scripted
desktop probes only; the real Windows and macOS probes run on hosted computers."""

import unittest

from ocade_agent import skillforge


class Clock:
    def __init__(self):
        self.t = 0.0

    def now(self):
        return self.t

    def sleep(self, seconds):
        self.t += seconds


def run(script, seconds=10, alive=lambda: True):
    """script: {time: (pointer, element, inside, values)} — a press completes at each time."""
    clock = Clock()
    state = {"values": [{"automationId": "customer", "name": "Customer", "controlType": "Edit", "value": ""}]}
    presses = sorted(script.items())

    def button_down():
        for at, _ in presses:
            if at <= clock.t < at + 0.1:
                return True
        return False

    def current():
        last = [event for at, event in presses if at <= clock.t]
        return last[-1] if last else None

    def snapshot():
        event = current()
        if event and "values" in event:
            state["values"] = event["values"]
        return state["values"]

    return skillforge.record(
        seconds, button_down, pointer=lambda: (1, 1),
        element_at=lambda x, y: current().get("element"), inside=lambda x, y: current().get("inside", True),
        snapshot=snapshot, alive=alive, now=clock.now, sleep=clock.sleep)


class RecorderTest(unittest.TestCase):
    def test_typed_text_then_a_press_are_two_ordered_steps(self):
        typed = [{"automationId": "customer", "name": "Customer", "controlType": "Edit", "value": "Acme"}]
        result = run({
            1.0: {"element": {"automationId": "customer", "controlType": "Edit", "name": "Customer"}, "values": typed},
            3.0: {"element": {"name": "Save", "controlType": "Button"}, "values": typed},
        })
        self.assertEqual([s["kind"] for s in result["steps"]], ["set_value", "invoke"], result)
        self.assertEqual(result["steps"][0]["value"], "Acme")
        self.assertEqual(result["steps"][1]["element"], {"name": "Save", "controlType": "Button"})

    def test_several_edits_of_one_field_are_one_step_with_the_final_text(self):
        result = run({
            1.0: {"values": [{"automationId": "customer", "name": "Customer", "controlType": "Edit", "value": "Ac"}]},
            2.0: {"values": [{"automationId": "customer", "name": "Customer", "controlType": "Edit", "value": "Acme Ltd"}]},
        })
        self.assertEqual(result["steps"], [{"kind": "set_value", "element": {"automationId": "customer"},
                                            "value": "Acme Ltd", "label": "Customer"}])

    def test_a_press_outside_the_window_is_ignored(self):
        result = run({1.0: {"element": {"name": "Other", "controlType": "Button"}, "inside": False}})
        self.assertEqual(result["steps"], [])

    def test_a_protected_field_is_a_secret_step_without_its_value(self):
        protected = {"name": "Protected text field", "automationId": "", "controlType": "Edit", "protected": True}
        result = run({1.0: {"element": protected, "values": [protected]}})
        self.assertEqual(result["steps"], [{"kind": "secret", "label": "Protected text field"}])
        self.assertNotIn("value", str(result["steps"]))

    def test_the_recording_is_bounded_and_ends_with_the_window(self):
        self.assertLessEqual(run({}, seconds=500)["recordedSeconds"], skillforge.MAX_SECONDS + 0.1)
        self.assertGreaterEqual(run({}, seconds=1)["recordedSeconds"], 5 - 0.1, "at least five seconds")
        gone = run({}, seconds=60, alive=lambda: False)
        self.assertFalse(gone["complete"])
        self.assertLess(gone["recordedSeconds"], 1)

    def test_a_lost_lease_does_not_read_the_window_at_start_or_at_stop(self):
        for closes_at in [0, 0.25]:
            with self.subTest(closes_at=closes_at):
                clock = Clock()
                snapshots = []

                def snapshot():
                    snapshots.append(clock.now())
                    return []

                result = skillforge.record(
                    10, lambda: False, lambda: (0, 0), lambda x, y: None, lambda x, y: False,
                    snapshot, lambda: clock.now() < closes_at, now=clock.now, sleep=clock.sleep,
                )
                self.assertFalse(result["complete"])
                self.assertEqual(result["steps"], [])
                self.assertTrue(all(at < closes_at for at in snapshots), snapshots)


if __name__ == "__main__":
    unittest.main()
