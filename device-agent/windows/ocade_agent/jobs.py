"""Long-running commands as tracked jobs (W3, D18): renders, exports, installs.

A job is one confirmed command started apart from the shell worker's call, so it can outlive
a 600 s call; on macOS and Linux it also outlives an agent restart (on Windows it ends with
the companion and then reads "lost"). Each job has a folder under the agent's home:

    spec.json    what to run, where, until when (written before it starts)
    output.log   everything it printed
    runner.json  the runner's and the command's process ids and creation times
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

import psutil

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
    import tempfile

    with tempfile.NamedTemporaryFile(mode="w", encoding="utf8", dir=path.parent, delete=False) as stream:
        temporary = Path(stream.name)
        try:
            json.dump(value, stream)
            stream.flush()
            os.fsync(stream.fileno())
        except BaseException:
            stream.close()
            temporary.unlink(missing_ok=True)
            raise
    try:
        os.replace(temporary, path)
        if os.name != "nt":
            parent = os.open(path.parent, os.O_RDONLY)
            try:
                os.fsync(parent)
            finally:
                os.close(parent)
    finally:
        temporary.unlink(missing_ok=True)


def _read(path: Path) -> dict | None:
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return None


def process_start(pid: int) -> float | None:
    try:
        return psutil.Process(pid).create_time()
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        return None


def _job_process(record: dict, name: str) -> psutil.Process | None:
    pid, started = record.get(name), record.get(f"{name}Start")
    if type(pid) is not int or pid <= 0 or type(started) not in (int, float):
        return None
    try:
        process = psutil.Process(pid)
        if (process.create_time() == started and process.is_running()
                and process.status() != psutil.STATUS_ZOMBIE):
            return process
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        pass
    return None


def _end_orphan(command: psutil.Process) -> bool:
    try:
        descendants = command.children(recursive=True)
        command.kill()
    except psutil.NoSuchProcess:
        return False
    except psutil.AccessDenied:
        return False
    for process in reversed(descendants):
        try:
            process.kill()
        except psutil.NoSuchProcess:
            continue
        except psutil.AccessDenied:
            return False
    _, still_alive = psutil.wait_procs([command, *descendants], timeout=2)
    for process in still_alive:
        try:
            if process.is_running() and process.status() != psutil.STATUS_ZOMBIE:
                return False
        except psutil.NoSuchProcess:
            continue
        except psutil.AccessDenied:
            return False
    return True


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
        executable = Path(sys.executable)
        if sys.platform == "win32":
            executable = executable.with_name("ocade-agent.exe")
        return [str(executable), "worker", "ocade_agent.job_runner"]
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
    from .discovery import command_environment

    runner = subprocess.Popen(
        runner_command(), cwd=workspace, env={**command_environment(home), "OCADE_JOB": str(here),
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
    elif _job_process(pids, "runner") is not None:
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
    if _job_process(pids, "runner") is None:
        command = _job_process(pids, "command")
        if command is not None and _end_orphan(command):
            _write(here / "exit.json", {"state": "cancelled", "exitCode": None, "ended": time.time()})
        return status(home, job)
    deadline = time.monotonic() + 10
    while _read(here / "exit.json") is None and time.monotonic() < deadline:
        time.sleep(0.05)
    return status(home, job)


def cancel_all(home: str) -> list[str]:
    """Signal every unfinished job immediately; return only confirmed cancellations."""
    root = folder(home)
    active = [
        here for here in sorted(root.iterdir())
        if here.name.isalnum() and (here / "spec.json").is_file() and not (here / "exit.json").exists()
    ] if root.is_dir() else []
    for here in active:
        (here / "cancel").touch()
    return [here.name for here in active if cancel(home, here.name)["state"] == "cancelled"]
