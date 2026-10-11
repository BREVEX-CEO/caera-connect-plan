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
# Windows UI Automation helper DLLs ship inside the uiautomation package.
uia_bin = []
if sys.platform == "win32":
    import uiautomation
    uia_bin = [(str(Path(uiautomation.__file__).parent / "bin"), "uiautomation/bin")]

a = Analysis(
    [str(root / "ocade_agent.py")],
    pathex=[str(root)],
    # Every file the runtime opens by path. `--health` opens them all, so a
    # build that forgot one fails its own health check before it ships.
    datas=[(str(root / "ocade_protocol.json"), "."),
           (str(root / "actions" / "ocade_page.js"), "actions"),
           (str(root / "actions" / "ocade_workbook.ps1"), "actions"),
           (str(root / "actions" / "ocade_document.ps1"), "actions"),
           # OCADE's wake model and its signed manifest: bundled, never downloaded.
           *[(str(f), "wake") for f in (root / "wake").iterdir()
             if f.name in ("manifest.json", "manifest.sig") or f.suffix == ".npz" and f.stem != "candidate"],
           *uia_bin],
    hiddenimports=[
        "ocade_device", "ocade_identity", "ocade_computer", "ocade_update",
        "ocade_egress", "ocade_wake", "ocade_existing_browser", "ocade_documents", "ocade_sheets", "ocade_accessibility",
        "ocade_settings", "psutil", "pycaw", "pycaw.pycaw",
        "uiautomation", "comtypes", "actions.browser_control",
        "pystray", "pystray._win32", "pystray._darwin", "pystray._xorg",
        "pynput.keyboard", "pynput.mouse", "numpy", "sounddevice",
    ],
    excludes=["PyQt6", "fastapi", "uvicorn", "google", "tinytuya", "cv2", "torch"],
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
