"""Element refs (P5): an action names exactly the element the newest inspection listed, and a
ref is refused once the element changed, the window was inspected again or it never existed.
Pure Python; the native elements are stand-ins, so this runs on every platform."""

import unittest

from ocade_agent import refs
from ocade_agent.sandbox import Refused


class ElementRefs(unittest.TestCase):
    def setUp(self):
        self.ok, self.again = object(), object()
        self.listed = [(self.ok, {"name": "OK", "automationId": "", "controlType": "Button"}),
                       (self.again, {"name": "OK", "automationId": "", "controlType": "Button"})]
        self.now = {id(self.ok): dict(self.listed[0][1]), id(self.again): dict(self.listed[1][1])}
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

    def test_a_new_inspection_replaces_the_old_refs(self):
        refs.remember("window", [(self.again, {"name": "OK", "automationId": "", "controlType": "Button"})])
        self.assertIs(refs.recall("window", {"ref": "e1"}, self.describe), self.again)
        self.assertEqual(self.refused({"ref": "e2"}), "element_stale")

    def test_only_the_newest_windows_are_kept(self):
        for n in range(9):
            refs.remember(f"w{n}", [(self.ok, {"name": "OK", "automationId": "", "controlType": "Button"})])
        self.assertEqual(self.refused({"ref": "e1"}, key="w0"), "element_stale")
        self.assertIs(refs.recall("w8", {"ref": "e1"}, self.describe), self.ok)


if __name__ == "__main__":
    unittest.main()
