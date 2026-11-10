"""KEY-001…006: one keyboard contract for every desktop (`ui.send_keys`).

Before it, `keys` was a bare string with no stated syntax: the Windows bridge read it as its
input library's command language (so typed text containing + ^ % ~ ( ) { } was corrupted and
"Ctrl+S" typed the letters C, t, r, l), and the macOS bridge could only type characters, so no
Enter, Tab or shortcut could be sent there at all. These tests are the translation only; the
real effect in a real window is test_windows_ui / test_mac_ui on the hosted desktops.
"""

import unittest

from ocade_agent import keys
from ocade_agent.sandbox import Refused


class KeyContract(unittest.TestCase):
    def test_text_is_typed_as_written_on_windows(self):
        # KEY-001: every character the input library reads as a command becomes a typed character.
        self.assertEqual(keys.windows_sequence([{"text": "=B7+1 is 100% (ok) {x} ~^"}]),
                         "=B7{+}1 is 100{%} {(}ok{)} {{}x{}} {~}{^}")

    def test_presses_and_shortcuts_on_windows(self):
        # KEY-002: named keys and modifiers; Mod is Ctrl; a letter is its plain key, never shifted.
        self.assertEqual(keys.windows_sequence([{"press": "Mod+Shift+T"}, {"text": "B7"}, {"press": "Enter"},
                                                {"press": "Alt+F4"}, {"press": "Ctrl+S"}, {"press": "PageDown"}]),
                         "^+tB7{ENTER}%{F4}^s{PGDN}")

    def test_the_same_list_on_macos(self):
        # KEY-003: text stays text; a press is a key code with its modifiers; Mod is Command.
        self.assertEqual(keys.mac_events([{"press": "Mod+S"}, {"text": "128"}, {"press": "Enter"},
                                          {"press": "Shift+Tab"}, {"press": "Cmd+Alt+F5"}]),
                         [("key", 0x01, ["command"]), ("text", "128"), ("key", 0x24, []),
                          ("key", 0x30, ["shift"]), ("key", 0x60, ["command", "option"])])

    def test_every_letter_digit_and_named_key_has_a_key_on_both_platforms(self):
        # KEY-004: nothing in the contract is missing from either translation.
        import string

        for key in list(string.ascii_letters + string.digits) + list(keys.NAMED):
            with self.subTest(key=key):
                self.assertTrue(keys.windows_sequence([{"press": key}]))
                [(kind, code, modifiers)] = keys.mac_events([{"press": key}])
                self.assertEqual((kind, modifiers), ("key", []))
                self.assertIsInstance(code, int)
        codes = [keys.mac_events([{"press": key}])[0][1] for key in list(string.ascii_lowercase + string.digits) + list(keys.NAMED)]
        self.assertEqual(len(codes), len(set(codes)), "no two keys share a key code")

    def test_what_is_not_a_key_is_refused_not_guessed(self):
        # KEY-005: an unknown key, a repeated or unknown modifier, a platform's missing key.
        for translate, press in ((keys.windows_sequence, "Hyper+S"), (keys.mac_events, "Ctrl+Ctrl+S"),
                                 (keys.windows_sequence, "Enter+S"), (keys.mac_events, "Return"),
                                 (keys.windows_sequence, "Cmd+S"), (keys.mac_events, "+"), (keys.windows_sequence, "é")):
            with self.subTest(press=press), self.assertRaisesRegex(Refused, "key_unsupported"):
                translate([{"press": press}])

    def test_a_malformed_list_is_refused_before_anything_is_typed(self):
        # KEY-006: the old bare string, an empty list, both kinds in one item, a control character.
        for bad in ("^s", [], [{}], [{"text": "a", "press": "Enter"}], [{"type": "a"}], [{"text": ""}],
                    [{"text": "line\nbreak"}], [{"press": 5}], [{"text": "x"}] * 21):
            for translate in (keys.windows_sequence, keys.mac_events):
                with self.subTest(bad=bad), self.assertRaisesRegex(Refused, "keys_invalid"):
                    translate(bad)


if __name__ == "__main__":
    unittest.main()
