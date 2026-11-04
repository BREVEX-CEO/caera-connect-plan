"""Long-running commands as tracked jobs (W3, D18): renders, exports, installs.

A job is one confirmed command started apart from the shell worker's call, so it can outlive
a 600 s call; on macOS and Linux it also outlives an agent restart (on Windows it ends with
the companion and then reads "lost"). Each job has a folder under the agent's home:

    spec.json    what to run, where, until when (written before it starts)
    output.log   everything it printed
    runner.json  the runner's and the command's process ids
    exit.json    how it ended: exit code, or timed out / cancelled (written by the runner)
    cancel       present when someone asked it to stop

`job_runner` starts the command in its own process group, enforces the deadline, honours
`cancel` and writes `exit.json`. Nothing here decides whether a command is safe: starting a
job is an external effect the person confirms, exactly like `shell.run`.
"""

from __future__ import annotations

import json
import os
import secrets
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path

OUTPUT_TAIL = 4_000
SHELLS = ("powershell", "cmd") if sys.platform == "win32" else ("sh", "bash", "zsh")


def shell_argv(command: str, shell: str | None) -> list[str]:
    """The exact program that runs a command, with no profile, prompt or rc files."""
    chosen = shell or SHELLS[0]
    if chosen not in SHELLS:
        raise LookupError("shell_unavailable")
    if chosen == "powershell":
        exe = shutil.which("pwsh") or shutil.which("powershell") or "powershell.exe"
        # -Command otherwise converts every nonzero native exit code to 1. Test $?
        # first: blindly exiting $LASTEXITCODE would hide a later PowerShell error.
        script = command + "\nif ($?) { exit 0 } elseif ($LASTEXITCODE) { exit $LASTEXITCODE } else { exit 1 }"
        return [exe, "-NoProfile", "-NonInteractive", "-NoLogo", "-Command", script]
    if chosen == "cmd":
        return [os.environ.get("COMSPEC") or "cmd.exe", "/d", "/s", "/c", command]
    if chosen == "sh":
        return ["/bin/sh", "-c", command]
    exe = shutil.which(chosen)
    if not exe:
        raise LookupError("shell_unavailable")
    return [exe, "--noprofile", "--norc", "-c", command] if chosen == "bash" else [exe, "-f", "-c", command]


def folder(home: str | os.PathLike) -> Path:
    return Path(home) / "jobs"


def _write(path: Path, value: dict) -> None:
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(value))
    os.replace(temporary, path)


def _read(path: Path) -> dict | None:
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return None


def _alive(pid: int | None) -> bool:
    if not pid:
        return False
    if sys.platform == "win32":
        import ctypes

        handle = ctypes.windll.kernel32.OpenProcess(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
        if not handle:
            return False
        code = ctypes.c_ulong()
        ctypes.windll.kernel32.GetExitCodeProcess(handle, ctypes.byref(code))
        ctypes.windll.kernel32.CloseHandle(handle)
        return code.value == 259  # STILL_ACTIVE
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        pass
    # A killed process nobody has reaped yet (a zombie) still answers kill(0): it is not running.
    state = subprocess.run(["ps", "-o", "stat=", "-p", str(pid)], capture_output=True, text=True).stdout.strip()
    return bool(state) and not state.startswith("Z")


def end_tree(pid: int) -> None:
    """End a command and everything it started (its own process group on POSIX)."""
    if sys.platform == "win32":
        subprocess.run(["taskkill", "/T", "/F", "/PID", str(pid)], capture_output=True)
        return
    try:
        os.killpg(pid, signal.SIGKILL)
    except (ProcessLookupError, PermissionError):
        pass


def runner_command() -> list[str]:
    if getattr(sys, "frozen", False):  # the packaged agent hosts its own modules
        return [str(Path(sys.executable).with_name("ocade-agent.exe")), "worker", "ocade_agent.job_runner"]
    return [sys.executable, "-s", "-m", "ocade_agent.job_runner"]


PACKAGE_ROOT = str(Path(__file__).resolve().parent.parent)


def start(home: str, workspace: str, command: str, shell: str | None, seconds: int) -> dict:
    argv = shell_argv(command, shell)
    job = secrets.token_hex(8)
    here = folder(home) / job
    here.mkdir(parents=True)
    _write(here / "spec.json", {"argv": argv, "cwd": workspace, "deadline": time.time() + seconds,
                                "started": time.time()})
    # POSIX: its own session, so it outlives the worker and an agent restart. Windows: it stays in
    # the shell worker's kill-on-close job object (breaking away is refused inside nested jobs),
    # so it ends with the companion and reads "lost" after a restart: never a silent orphan.
    flags = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
    runner = subprocess.Popen(
        runner_command(), cwd=workspace, env={**os.environ, "OCADE_JOB": str(here),
             "PYTHONPATH": os.pathsep.join(filter(None, (PACKAGE_ROOT, os.environ.get("PYTHONPATH"))))},
        stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        start_new_session=sys.platform != "win32", creationflags=flags,
    )
    deadline = time.monotonic() + 10
    while _read(here / "runner.json") is None and _read(here / "exit.json") is None:
        if runner.poll() is not None or time.monotonic() > deadline:
            return {"jobId": job, "state": "failed_to_start"}
        time.sleep(0.02)
    return {"jobId": job, "state": "running"}


def status(home: str, job: str) -> dict:
    here = folder(home) / job
    spec = _read(here / "spec.json") if job.isalnum() else None
    if spec is None:
        raise LookupError("unknown_job")
    ended = _read(here / "exit.json")
    pids = _read(here / "runner.json") or {}
    if ended:
        state = ended["state"]
    elif _alive(pids.get("runner")):
        state = "running"
    else:
        state = "lost"  # neither running nor recorded as ended: its effect is unknown
    try:
        with open(here / "output.log", "rb") as stream:
            stream.seek(0, os.SEEK_END)
            stream.seek(max(0, stream.tell() - OUTPUT_TAIL))
            tail = stream.read().decode("utf-8", errors="replace")
    except OSError:
        tail = ""
    return {"jobId": job, "state": state, "exitCode": (ended or {}).get("exitCode"),
            "seconds": round(((ended or {}).get("ended") or time.time()) - spec["started"], 1),
            "outputTail": tail}


def cancel(home: str, job: str) -> dict:
    here = folder(home) / job
    current = status(home, job)
    if current["state"] not in ("running", "lost"):
        return current
    (here / "cancel").touch()
    pids = _read(here / "runner.json") or {}
    if not _alive(pids.get("runner")) and pids.get("command"):
        end_tree(pids["command"])  # the runner is gone: end its command directly
        _write(here / "exit.json", {"state": "cancelled", "exitCode": None, "ended": time.time()})
    deadline = time.monotonic() + 10
    while _read(here / "exit.json") is None and time.monotonic() < deadline:
        time.sleep(0.05)
    return status(home, job)


def cancel_all(home: str) -> list[str]:
    """STOP: every job still running ends."""
    ended = []
    root = folder(home)
    for here in sorted(root.iterdir()) if root.is_dir() else []:
        if (here / "spec.json").exists() and not (here / "exit.json").exists():
            cancel(home, here.name)
            ended.append(here.name)
    return ended
