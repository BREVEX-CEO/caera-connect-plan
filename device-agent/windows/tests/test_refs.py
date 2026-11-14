"""Element refs (P5, C5): an action names exactly the element an inspection listed; a unique
control keeps its ref across inspections, and a ref is refused once its element changed or it
never existed.
Pure Python; the native elements are stand-ins, so this runs on every platform."""

import unittest
import unittest.mock

from ocade_agent import refs
from ocade_agent.sandbox import Refused


class ElementRefs(unittest.TestCase):
    def setUp(self):
        self.ok, self.again = object(), object()
        self.listed = [(self.ok, {"name": "OK", "automationId": "", "controlType": "Button"}),
                       (self.again, {"name": "OK", "automationId": "", "controlType": "Button"})]
        self.now = {id(self.ok): dict(self.listed[0][1]), id(self.again): dict(self.listed[1][1])}
        refs._kept.clear()
        refs.remember("window", self.listed)

    def describe(self, native):
        return self.now[id(native)]

    def refused(self, element, key="window"):
        with self.assertRaises(Refused) as caught:
            refs.recall(key, element, self.describe)
        return caught.exception.code

    def test_each_listed_element_gets_its_own_ref_even_with_a_repeated_label(self):
        self.assertEqual([d["ref"] for _, d in self.listed], ["e1", "e2"])
        self.assertIs(refs.recall("window", {"ref": "e2"}, self.describe), self.again)
        self.assertIs(refs.recall("window", {"ref": "e1", "name": "OK"}, self.describe), self.ok)

    def test_a_ref_is_refused_once_its_element_changed_or_disappeared(self):
        self.now[id(self.ok)]["name"] = "Cancel"
        self.assertEqual(self.refused({"ref": "e1"}), "element_stale")
        self.now[id(self.again)] = None  # describing a vanished element fails
        self.assertEqual(self.refused({"ref": "e2"}), "element_stale")

    def test_a_ref_is_refused_when_unknown_from_another_window_or_contradicted(self):
        self.assertEqual(self.refused({"ref": "e3"}), "element_stale")
        self.assertEqual(self.refused({"ref": "e1"}, key="other window"), "element_stale")
        self.assertEqual(self.refused({"ref": "e1", "name": "Cancel"}), "element_stale")

    def test_a_unique_control_keeps_its_ref_and_a_repeated_label_gets_a_new_one(self):
        save = object()
        self.now[id(save)] = {"name": "Save", "automationId": "", "controlType": "Button"}
        refs.remember("window", [(save, dict(self.now[id(save)]))])  # e3: the counter moves on
        listed = [(save, dict(self.now[id(save)])), (self.again, dict(self.listed[1][1]))]
        diff = refs.remember("window", listed)
        self.assertEqual([d["ref"] for _, d in listed], ["e3", "e4"])
        self.assertIs(refs.recall("window", {"ref": "e3"}, self.describe), save)
        self.assertEqual(diff, {"changed": ["e4"], "removed": []})
        self.assertEqual(self.refused({"ref": "e1"}), "element_stale")  # the two OKs: refs not carried over

    def test_changes_only_lists_new_or_changed_controls_and_the_refs_that_went(self):
        field, ok = object(), object()
        first = [(field, {"name": "Name", "automationId": "n", "controlType": "Edit", "value": ""}),
                 (ok, {"name": "OK", "automationId": "ok", "controlType": "Button", "enabled": True})]
        self.assertIsNone(refs.remember("dialog", first))
        again = [(field, {"name": "Name", "automationId": "n", "controlType": "Edit", "value": "Ada"})]
        diff = refs.remember("dialog", again)
        self.assertEqual(refs.listing(again, diff, True),
                         {"elements": [again[0][1]], "removed": ["e2"], "unchanged": 0})
        same = [(field, {"name": "Name", "automationId": "n", "controlType": "Edit", "value": "Ada"})]
        listed = refs.listing(same, refs.remember("dialog", same), True)
        self.assertEqual(listed, {"elements": [], "removed": [], "unchanged": 1})
        self.assertEqual(refs.listing(same, None, True), {"elements": [same[0][1]]})  # a first look lists all
        self.assertEqual(refs.listing(same, {"changed": [], "removed": []}, False), {"elements": [same[0][1]]})

    def test_only_the_newest_windows_are_kept(self):
        for n in range(9):
            refs.remember(f"w{n}", [(self.ok, {"name": "OK", "automationId": "", "controlType": "Button"})])
        self.assertEqual(self.refused({"ref": "e1"}, key="w0"), "element_stale")
        self.assertIs(refs.recall("w8", {"ref": "e1"}, self.describe), self.ok)


class WaitFor(unittest.TestCase):
    """C6: ui.wait's loop, with a stand-in for finding the element."""

    def finder(self, *results):
        calls = iter(results)

        def find():
            result = next(calls)
            if result is not None:
                raise Refused(result)
        return find

    def test_returns_once_the_element_is_there(self):
        with unittest.mock.patch.object(refs.time, "sleep"):
            met = refs.wait_for(self.finder("element_not_found", "element_not_found", None), False, 5000)
        self.assertTrue(met["met"])

    def test_gone_is_met_when_the_element_or_its_window_goes(self):
        with unittest.mock.patch.object(refs.time, "sleep"):
            self.assertTrue(refs.wait_for(self.finder(None, "element_stale"), True, 5000)["met"])
            self.assertTrue(refs.wait_for(self.finder(None, "window_gone"), True, 5000)["met"])

    def test_not_met_in_time_is_a_refusal_and_other_refusals_pass_through(self):
        with self.assertRaises(Refused) as caught:
            refs.wait_for(lambda: (_ for _ in ()).throw(Refused("element_not_found")), False, 300)
        self.assertEqual(caught.exception.code, "wait_timed_out")
        with self.assertRaises(Refused) as caught:
            refs.wait_for(self.finder("window_gone"), False, 5000)  # waiting for it to appear
        self.assertEqual(caught.exception.code, "window_gone")


if __name__ == "__main__":
    unittest.main()
