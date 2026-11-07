# PyInstaller build of the OCADE JARVIS companion (plan.md §26, P04).
# Two executables from one analysis: `ocade-agent.exe` (console: pairing, STOP and
# the stdio capability workers) and `ocade-agent-bg.exe` (no window: the per-user
# background agent started at sign-in). Build with packaging/build.ps1 on Windows.
# STATUS: Windows build UNTESTED (no Windows host); the same spec builds and runs on Linux.
import os
import sys
from pathlib import Path

from PyInstaller.utils.hooks import collect_data_files, collect_submodules, copy_metadata

# Every companion module, listed from disk: collect_submodules("ocade_agent") runs in a child
# process that cannot see this source tree and silently returned nothing (no workers shipped).
ROOT = os.path.abspath(os.path.join(SPECPATH, ".."))
bundled = sorted(f"ocade_agent.{path.stem}" for path in Path(ROOT, "ocade_agent").glob("*.py"))
for worker in ("office_worker", "verify_worker", "windows_worker", "web_worker", "media_worker", "command_worker"):
    assert f"ocade_agent.{worker}" in bundled, f"ocade_agent.{worker} missing from the build"

# The frozen installer must carry its own Playwright Chromium, not depend on
# the builder's profile or a separately installed browser on a customer PC.
BROWSERS = Path(SPECPATH, "playwright-browsers")
if sys.platform == "win32":
    if not BROWSERS.is_dir() or not any(BROWSERS.rglob("chrome.exe")):
        raise RuntimeError("Missing packaged Playwright Chromium; run packaging/build.ps1")
elif sys.platform == "darwin":
    marker = BROWSERS / ".ocade-browser-path"
    browser = (BROWSERS / marker.read_text(encoding="utf-8").strip()).resolve()
    if not browser.is_file() or not browser.is_relative_to(BROWSERS.resolve()):
        raise RuntimeError("Missing package-local macOS Chromium")
else:
    raise RuntimeError("The companion installer targets Windows and macOS")

trust_file = os.environ.get("OCADE_RELEASE_PUBLIC_KEY_FILE")
trust_data = []
if trust_file:
    import base64

    public_key = Path(trust_file).resolve(strict=True)
    if len(base64.b64decode(public_key.read_text(encoding="ascii").strip(), validate=True)) != 32:
        raise RuntimeError("Expected one Ed25519 public key in base64")
    if public_key.name != "release-key.txt":
        raise RuntimeError("Name the release public key release-key.txt")
    trust_data = [(str(public_key), "ocade_agent")]

native_modules = (
    collect_submodules("pywinauto") + ["win32timezone", "pyautogui"]
    if sys.platform == "win32"
    else ["ApplicationServices", "AppKit", "Foundation", "Quartz"]
)

block_cipher = None
analysis = Analysis(
    [os.path.join(ROOT, "ocade_agent", "__main__.py")],
    pathex=[ROOT],
    datas=[
        (os.path.join(ROOT, "ocade_agent", "protocol.json"), "ocade_agent"),
        (str(BROWSERS), "playwright-browsers"),
    ]
    # The Word and PowerPoint libraries build new files from their own bundled templates.
    + collect_data_files("docx")
    + collect_data_files("pptx")
    + copy_metadata("psutil")
    + trust_data,
    hiddenimports=bundled + native_modules
    + collect_submodules("send2trash")
    + ["playwright.async_api", "pptx"],
    # pymsgbox and mouseinfo (GPL-3.0) are optional imports of pyautogui that OCADE never
    # uses; leaving them out keeps GPL code out of the installer (release/third-party-licences.json).
    excludes=["tkinter", "pymsgbox", "mouseinfo"],
)
# Redistribution (182): fail the build, not the audit, if an excluded GPL module is still pulled in.
leaked = sorted({entry[0] for entry in analysis.pure + analysis.binaries
                 if entry[0].split(".")[0] in ("pymsgbox", "mouseinfo")})
if leaked:
    raise SystemExit(f"GPL modules would ship in the installer: {leaked}")
pyz = PYZ(analysis.pure, cipher=block_cipher)
common = dict(debug=False, strip=False, upx=False)
if sys.platform == "win32":
    common["version"] = "version.txt"
console = EXE(pyz, analysis.scripts, [], exclude_binaries=True, name="ocade-agent", console=True, **common)
if sys.platform == "win32":
    background = EXE(pyz, analysis.scripts, [], exclude_binaries=True, name="ocade-agent-bg", console=False, **common)
    COLLECT(console, background, analysis.binaries, analysis.datas, name="OCADE JARVIS")
else:
    contents = COLLECT(console, analysis.binaries, analysis.datas, name="OCADE JARVIS")
    BUNDLE(contents, name="OCADE JARVIS.app", bundle_identifier="in.ocade.jarvis.companion",
           info_plist={"CFBundleShortVersionString": "0.1.0", "CFBundleVersion": "0.1.0"})
