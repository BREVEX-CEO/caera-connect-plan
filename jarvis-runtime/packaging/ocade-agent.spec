# PyInstaller build of the OCADE Device Agent (one folder, no console window).
#
#   cd jarvis-runtime && pyinstaller packaging/ocade-agent.spec
#
# Output: dist/ocade-agent/ (Windows: ocade-agent.exe; macOS: wrapped as
# "OCADE Device Agent.app" by packaging/macos/build.sh). The person never
# installs Python or packages. The browser engine is fetched on first use
# into the agent's own cache, only if a browser task needs it.
# ruff: noqa
import sys
from pathlib import Path

root = Path(SPECPATH).parent

a = Analysis(
    [str(root / "ocade_agent.py")],
    pathex=[str(root)],
    datas=[(str(root / "ocade_protocol.json"), ".")],
    hiddenimports=[
        "ocade_device", "ocade_identity", "ocade_computer", "ocade_update", "ocade_mini",
        "actions.browser_control", "pystray", "pynput.keyboard", "pynput.mouse",
    ],
    excludes=["PyQt6", "fastapi", "uvicorn", "google", "tinytuya", "cv2", "numpy"],
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz, a.scripts, [],
    exclude_binaries=True,
    name="ocade-agent",
    console=False,
    icon=str(root / "config" / "jarvis.ico") if sys.platform == "win32" else None,
    codesign_identity=None,  # signing happens in the platform scripts, with the owner's identity
)
coll = COLLECT(exe, a.binaries, a.datas, name="ocade-agent")
