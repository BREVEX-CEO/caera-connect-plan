# PyInstaller build of the OCADE JARVIS companion (plan.md §26, P04).
# Two executables from one analysis: `ocade-agent.exe` (console: pairing, STOP and
# the stdio capability workers) and `ocade-agent-bg.exe` (no window: the per-user
# background agent started at sign-in). Build with packaging/build.ps1 on Windows.
# STATUS: CODED, UNTESTED.
from PyInstaller.utils.hooks import collect_submodules

block_cipher = None
analysis = Analysis(
    ["../ocade_agent/__main__.py"],
    pathex=[".."],
    datas=[("../ocade_agent/protocol.json", "ocade_agent")],
    hiddenimports=collect_submodules("ocade_agent")
    + collect_submodules("pywinauto")
    + ["win32timezone", "pyautogui", "playwright.async_api"],
    excludes=["tkinter"],
)
pyz = PYZ(analysis.pure, cipher=block_cipher)
common = dict(debug=False, strip=False, upx=False, version="version.txt")
console = EXE(pyz, analysis.scripts, [], exclude_binaries=True, name="ocade-agent", console=True, **common)
background = EXE(pyz, analysis.scripts, [], exclude_binaries=True, name="ocade-agent-bg", console=False, **common)
COLLECT(console, background, analysis.binaries, analysis.datas, name="OCADE JARVIS")
