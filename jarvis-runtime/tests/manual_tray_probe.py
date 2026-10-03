"""
Read the Windows notification area, including the hidden-icons flyout, for OCADE's icon.
Opens the flyout, reads it, optionally opens OCADE's menu and reads that, then closes both.
  python tray_probe.py [menu]
"""
import sys
import time
import uiautomation as auto

sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def walk(control, out, depth=0):
    if depth > 14:
        return
    try:
        out.append(control)
        for child in control.GetChildren():
            walk(child, out, depth + 1)
    except Exception:
        pass


def everything():
    out = []
    for top in auto.GetRootControl().GetChildren():
        walk(top, out, 10)  # top-level windows and a few levels only, except the tray ones below
    return out


def tray_controls():
    out = []
    for top in auto.GetRootControl().GetChildren():
        if top.ClassName in ("Shell_TrayWnd", "TopLevelWindowForOverflowXamlIsland", "NotifyIconOverflowWindow",
                             "Xaml_WindowedPopupClass"):
            walk(top, out)
    return out


def icons():
    return [c for c in tray_controls() if c.ControlTypeName == "ButtonControl" and "OCADE" in (c.Name or "").upper()]


found = icons()
opened = None
if not found:
    opened = next((c for c in tray_controls() if c.Name == "Show Hidden Icons"), None)
    if opened is not None:
        opened.GetInvokePattern().Invoke()
        time.sleep(1.2)
        found = icons()
print(len(found), "OCADE tray icon(s):", [c.Name for c in found])
code = 0 if len(found) == 1 else 1
if found and len(sys.argv) > 1:
    found[0].RightClick(simulateMove=False)
    time.sleep(1.0)
    items = []
    for top in auto.GetRootControl().GetChildren():
        if top.ControlTypeName == "MenuControl" or top.ClassName == "#32768":
            got = []
            walk(top, got)
            items = [c.Name for c in got if c.ControlTypeName == "MenuItemControl"]
    print("menu:", items)
    auto.SendKeys("{Esc}")
    time.sleep(0.3)
if opened is not None:
    auto.SendKeys("{Esc}")
sys.exit(code)
