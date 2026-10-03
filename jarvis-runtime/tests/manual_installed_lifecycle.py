"""
The installed Device Agent's whole life on this Windows computer, for real.

    node scripts/e2e/harness.mjs --no-build --serve
    python jarvis-runtime/packaging/release.py --version <older> --base http://127.0.0.1:8788
    python jarvis-runtime/packaging/release.py --version <newer> --base http://127.0.0.1:8788 \\
        --publish-local --no-installer
    python jarvis-runtime/tests/manual_installed_lifecycle.py <the older Setup.exe>

The real installer, the real login entry, the real program and the real update
feed: install, connect, one instance, the signed update installing itself while
idle, a broken newer build rolled back at once and not fetched again, uninstall,
reinstall. It talks only to the OCADE site on this computer and keeps its key in
a folder of its own, so a real connection to OCADE is never touched.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
import winreg
from pathlib import Path

RUNTIME = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RUNTIME))
import ocade_agent  # noqa: E402

SERVER = "http://127.0.0.1:8788"
STUB = "http://127.0.0.1:54321"
APP = Path(os.environ["LOCALAPPDATA"]) / "OCADE" / "Device Agent"
RUN = r"Software\Microsoft\Windows\CurrentVersion\Run"
UNINSTALL = r"Software\Microsoft\Windows\CurrentVersion\Uninstall\{6F0C4E2B-8D1A-4C57-9F3E-0CADE0A6E171}_is1"
SILENT = ["/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART"]

failures = 0


def check(name: str, ok: bool, detail: str = "") -> None:
    global failures
    failures += 0 if ok else 1
    print(f"{'PASS' if ok else 'FAIL'}  {name}{' - ' + detail if detail else ''}", flush=True)


def fetch(url: str):
    with urllib.request.urlopen(url, timeout=30) as response:
        return json.loads(response.read())


def running() -> list[str]:
    """Where every running agent program was started from."""
    out = subprocess.run(
        ["powershell", "-NoProfile", "-Command",
         "Get-CimInstance Win32_Process -Filter \"name='ocade-agent.exe'\" | "
         "ForEach-Object { $_.ExecutablePath }"], capture_output=True, text=True).stdout
    return [line.strip() for line in out.splitlines() if line.strip()]


def registry(path: str, name: str) -> str | None:
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, path) as key:
            return winreg.QueryValueEx(key, name)[0]
    except FileNotFoundError:
        return None


def layout() -> dict:
    try:
        return json.loads((APP / "current.json").read_text())
    except (OSError, ValueError):
        return {}


def until(condition, timeout_s: float, every_s: float = 1.0) -> bool:
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        if condition():
            return True
        time.sleep(every_s)
    return bool(condition())


def only(version: str) -> bool:
    now = running()
    return len(now) == 1 and f"\\versions\\{version}\\" in now[0]


def start_as_login(env: dict) -> None:
    command = registry(RUN, "OCADE")
    subprocess.Popen(command, env=env, creationflags=subprocess.DETACHED_PROCESS)


def approve() -> dict:
    out = subprocess.run(["node", "scripts/e2e/approve-device.mjs"], cwd=RUNTIME.parent,
                         capture_output=True, text=True)
    try:
        return json.loads(out.stdout.strip().splitlines()[-1])
    except (ValueError, IndexError):
        return {}


def main() -> int:
    setup = Path(sys.argv[1]).resolve()
    home = Path(tempfile.mkdtemp(prefix="ocade-lifecycle-home-"))
    env = {**os.environ, "OCADE_SERVER": SERVER, "OCADE_JARVIS_HOME": str(home)}
    ocade_agent.ocade_device.HOME = home  # "exit" carries the token the installed agent wrote there
    real_home = Path.home() / ".ocade_jarvis"
    had_real_home = real_home.exists()
    kept = Path(tempfile.mkdtemp(prefix="ocade-real-home-")) / "copy"
    if had_real_home:
        shutil.copytree(real_home, kept)

    newer = str(fetch(f"{SERVER}/agent/manifest.json")["version"])
    if APP.exists() or running() or registry(RUN, "OCADE"):
        print("An OCADE Device Agent is already installed or running here. Remove it first.")
        return 2
    try:
        # --- install ---------------------------------------------------------
        done = subprocess.run([str(setup), *SILENT], env=env).returncode
        versions = sorted(p.name for p in (APP / "versions").iterdir()) if (APP / "versions").is_dir() else []
        older = versions[0] if versions else "?"
        exe = APP / "versions" / older / "ocade-agent.exe"
        check("one run of the installer installs the program, with no administrator prompt",
              done == 0 and exe.is_file() and versions == [older], f"{older} in {APP}")
        check("it starts with Windows from then on", registry(RUN, "OCADE") == f'"{exe}"', str(registry(RUN, "OCADE")))
        check("Windows lists it as an installed app that can be removed",
              registry(UNINSTALL, "DisplayName") == "OCADE Device Agent"
              and registry(UNINSTALL, "DisplayVersion") == older)
        check("it is running as soon as the installer ends", until(lambda: only(older), 30))

        # --- connect ---------------------------------------------------------
        until(lambda: len(fetch(f"{STUB}/rest/v1/jarvis_devices?user_id=is.null&select=id")) > 0, 30)
        approved = approve()
        device = approved.get("approved")
        check("it asks to be connected, and a signed-in person approves it in OCADE", bool(device), str(approved))
        check("the key it made stays on this computer, in its own folder",
              until(lambda: (home / "device.key").is_file() and (home / "device.json").is_file(), 30))

        def owned() -> bool:
            rows = fetch(f"{STUB}/rest/v1/jarvis_devices?id=eq.{device}&select=user_id")
            return bool(rows) and rows[0].get("user_id") == approved.get("user")
        check("OCADE has it under that account", until(owned, 30))
        waiting = fetch(f"{STUB}/rest/v1/jarvis_devices?user_id=is.null&select=id")  # other runs' requests

        probe = subprocess.run([sys.executable, str(Path(__file__).with_name("manual_tray_probe.py")), "menu"],
                               capture_output=True, text=True)
        check("it is exactly one icon in the notification area, with Open, STOP and Exit",
              probe.returncode == 0 and all(word in probe.stdout for word in ("Open OCADE JARVIS", "STOP JARVIS", "Exit")),
              " | ".join(probe.stdout.split()))

        start_as_login(env)
        time.sleep(6)
        check("starting it again while it runs leaves one agent, not two", only(older), str(running()))

        # --- the signed update installs itself --------------------------------
        check(f"it finds the signed release {newer}, installs it while idle and restarts into it",
              until(lambda: layout().get("current") == newer and only(newer), 360, 3),
              f"{layout()} {running()}")
        now = layout()
        check("the build it came from is kept to roll back to",
              now.get("previous") == older and now.get("installed") == older and exe.is_file(), str(now))
        check("a build that stays up is recorded as started", until(lambda: layout().get("failedStarts") == 0, 45))
        check("it is still the same connected computer: no second approval is asked for",
              owned() and all(row in waiting for row in
                              fetch(f"{STUB}/rest/v1/jarvis_devices?user_id=is.null&select=id")))
        check("the login entry still starts the installed program, which hands over",
              registry(RUN, "OCADE") == f'"{exe}"')

        # --- a newer build that cannot run is rolled back at once -------------
        check("Exit ends it", ocade_agent.stop_running_agent(20) and until(lambda: running() == [], 15), str(running()))
        broken = APP / "versions" / newer / "ocade-agent.exe"
        broken.rename(broken.with_suffix(".gone"))
        start_as_login(env)
        check("with the newer program gone, the next start runs the build before it",
              until(lambda: only(older), 30), str(running()))
        now = layout()
        check("and records what it rolled back from",
              now.get("current") == older and now.get("rolledBackFrom") == newer, str(now))
        time.sleep(60)  # one full update check happens in this time
        check("the release it rolled back from is not fetched and installed again",
              layout().get("current") == older and only(older) and not broken.exists(), str(layout()))

        # --- uninstall -------------------------------------------------------
        uninstaller = APP / "unins000.exe"
        done = subprocess.run([str(uninstaller), *SILENT], env=env).returncode
        gone = until(lambda: running() == [] and not (APP / "versions").exists(), 60)
        check("uninstalling stops it and removes the program", done == 0 and gone, f"{running()} {APP.exists()}")
        check("nothing starts at login any more", registry(RUN, "OCADE") is None)
        check("Windows no longer lists it", registry(UNINSTALL, "DisplayName") is None)
        check("its key and cache are gone from this computer", not (home / "device.key").exists())
        rows = fetch(f"{STUB}/rest/v1/jarvis_devices?id=eq.{device}&select=id,revoked_at")
        check("and the key stops working in OCADE too",
              rows == [] or bool(rows[0].get("revoked_at")), str(rows))
        check("a different OCADE folder on this computer is left alone",
              real_home.exists() == had_real_home)

        # --- reinstall -------------------------------------------------------
        home.mkdir(exist_ok=True)
        done = subprocess.run([str(setup), *SILENT], env=env).returncode
        check("installing again works and it runs", done == 0 and until(lambda: only(older), 30), str(running()))
        check("it is a new computer to OCADE: it asks to be connected again",
              until(lambda: len(fetch(f"{STUB}/rest/v1/jarvis_devices?user_id=is.null&select=id")) > 0, 30))

        # --- uninstalling before it was ever connected -------------------------
        done = subprocess.run([str(APP / "unins000.exe"), *SILENT], env=env).returncode
        check("an agent still waiting to be connected is stopped and removed too",
              done == 0 and until(lambda: running() == [] and not (APP / "versions").exists(), 60)
              and registry(RUN, "OCADE") is None, f"{running()} {registry(RUN, 'OCADE')}")

        # --- uninstalling an agent that has stopped answering -------------------
        subprocess.run([str(setup), *SILENT], env=env)
        until(lambda: only(older), 30)
        import psutil
        for process in psutil.process_iter(["name"]):
            if process.info["name"] == "ocade-agent.exe":
                process.suspend()  # frozen: it cannot answer "exit"
        done = subprocess.run([str(APP / "unins000.exe"), *SILENT], env=env).returncode
        check("an agent that has stopped answering is ended, and nothing is left behind",
              done == 0 and until(lambda: running() == [] and not (APP / "versions").exists(), 60)
              and registry(RUN, "OCADE") is None, f"{running()} {registry(RUN, 'OCADE')}")
    finally:
        uninstaller = APP / "unins000.exe"
        if uninstaller.is_file():
            subprocess.run([str(uninstaller), *SILENT], env=env)
        until(lambda: running() == [], 30)
        check("the computer is left as it was found",
              running() == [] and registry(RUN, "OCADE") is None and not (APP / "versions").exists())
        if had_real_home and not real_home.exists():
            shutil.copytree(kept, real_home)
            check("a different OCADE folder on this computer is left alone", False, "restored from the copy")
        shutil.rmtree(home, ignore_errors=True)
        shutil.rmtree(kept.parent, ignore_errors=True)
    print(f"\n{'Installed lifecycle proof passed' if failures == 0 else f'{failures} failed'}")
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
