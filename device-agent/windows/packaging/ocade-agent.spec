# PyInstaller build of the OCADE JARVIS companion (plan.md §26, P04).
# Two executables from one analysis: `ocade-agent.exe` (console: pairing, STOP and
# the stdio capability workers) and `ocade-agent-bg.exe` (no window: the per-user
# background agent started at sign-in). Build with packaging/build.ps1 on Windows.
# STATUS: Windows build UNTESTED (no Windows host); the same spec builds and runs on Linux.
import os
from pathlib import Path

from PyInstaller.utils.hooks import collect_submodules

# Every companion module, listed from disk: collect_submodules("ocade_agent") runs in a child
# process that cannot see this source tree and silently returned nothing (no workers shipped).
ROOT = os.path.abspath(os.path.join(SPECPATH, ".."))
bundled = sorted(f"ocade_agent.{path.stem}" for path in Path(ROOT, "ocade_agent").glob("*.py"))
for worker in ("office_worker", "verify_worker", "windows_worker", "web_worker", "media_worker", "command_worker"):
    assert f"ocade_agent.{worker}" in bundled, f"ocade_agent.{worker} missing from the build"

# The frozen installer must carry its own Playwright Chromium, not depend on
# the builder's profile or a separately installed browser on a customer PC.
BROWSERS = Path(SPECPATH, "playwright-browsers")
if not BROWSERS.is_dir() or not any(BROWSERS.rglob("chrome.exe")):
    raise RuntimeError("Missing packaged Playwright Chromium; run packaging/build.ps1")

block_cipher = None
analysis = Analysis(
    [os.path.join(ROOT, "ocade_agent", "__main__.py")],
    pathex=[ROOT],
    datas=[
        (os.path.join(ROOT, "ocade_agent", "protocol.json"), "ocade_agent"),
        (str(BROWSERS), "playwright-browsers"),
    ],
    hiddenimports=bundled
    + collect_submodules("pywinauto")
    + ["win32timezone", "pyautogui", "playwright.async_api"],
    excludes=["tkinter"],
)
pyz = PYZ(analysis.pure, cipher=block_cipher)
common = dict(debug=False, strip=False, upx=False, version="version.txt")
console = EXE(pyz, analysis.scripts, [], exclude_binaries=True, name="ocade-agent", console=True, **common)
background = EXE(pyz, analysis.scripts, [], exclude_binaries=True, name="ocade-agent-bg", console=False, **common)
COLLECT(console, background, analysis.binaries, analysis.datas, name="OCADE JARVIS")
