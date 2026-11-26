# Linux desktop control (plan W14, items 134 and 135)

What the companion supports on Linux, what it refuses by name, and what is not tested.
Code: `device-agent/windows/ocade_agent/linux_worker.py`. Tests: `device-agent/windows/tests/test_linux_ui.py`,
`test_held_input.py` (X11 case), run on a virtual X server (Xvfb) in CI. No consumer Linux desktop was tested.

## Supported

- An **X11 session** (`DISPLAY` set, `XDG_SESSION_TYPE` not `wayland`).
- Window level control through three system libraries loaded with ctypes (no Python package is added):
  `libX11.so.6`, `libXtst.so.6` (input) and `libXss.so.1` (idle time). Package names: Debian/Ubuntu
  `libx11-6 libxtst6 libxss1`; Fedora `libX11 libXtst libXScrnSaver`. A missing library is a named
  refusal (`display_unavailable`, `input_unavailable`, `person_activity_unknown`), never a crash.
- Apps come from desktop entries (`*.desktop`) in `$XDG_DATA_HOME/applications` and `$XDG_DATA_DIRS`
  (defaults of the XDG specification). Hidden, no-display, terminal and link entries and entries whose
  program is missing or not executable are not offered.
- Every action first proves the window is still the one leased (window id, process id, executable and
  process start time) and refuses otherwise. Clicks are checked against a fresh image of the window
  and a topmost-window test; keys go only while the leased window holds the keyboard focus; nothing is
  done while the person's keyboard or mouse was used in the last 1.5 s. STOP releases held modifiers
  and buttons. `ocade_agent stop` is the local STOP (there is no tray icon on Linux).

## Refused by name

| Refusal                                  | When                                                                                                                                                                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `wayland_unsupported`                    | A Wayland session: compositors do not let a client read other windows or inject input, and windows seen through XWayland are not the whole desktop. Portals (screencast, remote desktop) are not used.                          |
| `display_unavailable`                    | No X display or no X library.                                                                                                                                                                                                   |
| `no_accessibility_tree`                  | `ui.invoke`, `ui.set_value`, `ui.wait`, `ui.scroll`, `ui.record`, and `ui.send_keys` aimed at a named control. AT-SPI is not used, so there are no named controls, and protected fields cannot be told apart from other pixels. |
| `key_unmappable`                         | A typed character the current keyboard layout has no key for. Nothing is sent.                                                                                                                                                  |
| `user_active`, `person_activity_unknown` | The person is using the keyboard or mouse, or their input cannot be read.                                                                                                                                                       |

## Not covered

AT-SPI accessibility, Wayland portals, a tray or floating bar, packaging (no Linux installer), a
distribution and desktop-environment matrix, and window-manager-specific behaviour beyond the standard
`_NET_ACTIVE_WINDOW` request. Plan item 135 stays UNTESTED beyond the Xvfb runs.
