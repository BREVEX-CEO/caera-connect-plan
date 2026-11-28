"""REQ-135: the Linux environment report names session, distribution, portal, missing libraries and the packaging files."""

import unittest
from pathlib import Path

from ocade_agent import linux_env

UBUNTU = 'NAME="Ubuntu"\nID=ubuntu\nID_LIKE=debian\nPRETTY_NAME="Ubuntu 24.04 LTS"\n'
FEDORA = 'ID=fedora\nPRETTY_NAME="Fedora Linux 41"\n'
PACKAGING = Path(__file__).resolve().parents[1] / "packaging" / "linux"


def facts(environ, release=UBUNTU, bus=frozenset(), missing=()):
    return linux_env.describe(environ, release, set(bus) if bus is not None else None,
                              lambda name: None if name in missing else f"lib{name}.so", executable="/usr/bin/python3")


class LinuxEnvironment(unittest.TestCase):
    def test_distribution_families(self):
        self.assertEqual(linux_env.distribution(UBUNTU), ("debian", "Ubuntu 24.04 LTS"))
        self.assertEqual(linux_env.distribution(FEDORA), ("fedora", "Fedora Linux 41"))
        self.assertEqual(linux_env.distribution("ID=weird\n")[0], "unknown")

    def test_wayland_names_the_portal_and_the_x11_route(self):
        with_portal = facts({"XDG_SESSION_TYPE": "wayland", "XDG_CURRENT_DESKTOP": "GNOME"}, bus={linux_env.PORTAL_NAME})
        self.assertEqual((with_portal["session"], with_portal["desktop"], with_portal["portal"], with_portal["supported"]),
                         ("wayland", "GNOME", True, False))
        self.assertIn("X11 session", with_portal["next_step"])
        self.assertIn("portal is running", with_portal["next_step"])
        without = facts({"XDG_SESSION_TYPE": "wayland"}, bus={"org.freedesktop.DBus"})
        self.assertFalse(without["portal"])
        self.assertIn("xdg-desktop-portal", without["next_step"])

    def test_missing_libraries_are_named_per_distribution(self):
        report = facts({"DISPLAY": ":0"}, FEDORA, bus={"x"}, missing=("Xtst", "Xss"))
        self.assertEqual([m["package"] for m in report["missing_libraries"]], ["libXtst", "libXScrnSaver"])
        self.assertFalse(report["supported"])
        self.assertEqual(report["next_step"], "Install: libXtst libXScrnSaver.")

    def test_a_complete_x11_session_is_ready(self):
        report = facts({"DISPLAY": ":0", "XDG_SESSION_TYPE": "x11"}, bus={"x"})
        self.assertTrue(report["supported"])
        self.assertEqual(report["next_step"], "Ready.")

    def test_no_session_and_no_user_bus_are_named(self):
        self.assertIn("graphical user session", facts({})["next_step"])
        self.assertIn("D-Bus", facts({"DISPLAY": ":0"}, bus=None)["next_step"])
        self.assertIsNone(facts({"DISPLAY": ":0"}, bus=None)["portal"])

    def test_packaging_files_exist_and_agree(self):
        desktop = (PACKAGING / "ocade-agent.desktop").read_text()
        unit = (PACKAGING / "ocade-agent.service").read_text()
        nfpm = (PACKAGING / "nfpm.yaml").read_text()
        self.assertIn("Exec=/opt/ocade/ocade-agent", desktop)
        self.assertIn("ExecStart=/opt/ocade/ocade-agent", unit)
        self.assertIn("NoNewPrivileges=true", unit)
        self.assertIn("dst: /opt/ocade/ocade-agent", nfpm)
        for family, names in (("deb", ("libx11-6", "libxtst6", "libxss1")), ("rpm", ("libX11", "libXtst", "libXScrnSaver"))):
            for name in names:
                self.assertIn(name, nfpm, family)
        for lib, packages in linux_env.LIBRARIES.items():
            self.assertIn(packages["debian"], nfpm)
            self.assertIn(packages["fedora"], nfpm)


if __name__ == "__main__":
    unittest.main()
