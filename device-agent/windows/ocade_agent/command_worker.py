"""`shell`: one command the person confirmed, run in the workspace folder (plan.md §1, P10).

PowerShell on Windows (`pwsh` when installed, else Windows PowerShell), `/bin/sh` elsewhere.
The risk is `external_effect`, so the server holds every command until the person has
read and confirmed it; nothing here decides whether a command is safe. What this
worker guarantees is containment of the run itself:

- the working folder is the workspace; no profile, no prompt, no standard input;
- the environment is the gateway's sanitized one (no account tokens or secrets);
- time is bounded; on timeout or STOP the whole process tree ends (a Windows job
  object that dies with this worker; a POSIX process group);
- output is bounded, and the exit code is reported as observed, never as success.
"""

from __future__ import annotations

import asyncio
import atexit
import os
import shutil
import signal
import subprocess
import sys
import time

from mcp.server.mcpserver import MCPServer

app = MCPServer("ocade-shell")
WORKSPACE = os.environ.get("OCADE_WORKSPACE", "")
OUTPUT_LIMIT = 6_000
# ponytail: a worker killed with SIGKILL on POSIX cannot end its command groups; Windows' job object can.
_running: set[int] = set()  # process groups of commands still running (POSIX)
_job: list = []  # the Windows job object, held for this process's life


def _shell(command: str) -> list[str]:
    if sys.platform == "win32":
        exe = shutil.which("pwsh") or shutil.which("powershell") or "powershell.exe"
        return [exe, "-NoProfile", "-NonInteractive", "-NoLogo", "-Command", command]
    return ["/bin/sh", "-c", command]


def _contain_children() -> None:
    """Every process a command starts ends when this worker ends (STOP or a crash ends the worker).

    Windows: the worker joins a kill-on-close job object that children inherit at birth.
    POSIX: each command runs in its own process group, ended on SIGTERM (the gateway's stop).
    """
    if sys.platform == "win32":
        import win32api  # type: ignore[import-not-found]
        import win32job  # type: ignore[import-not-found]

        job = win32job.CreateJobObject(None, "")
        limits = win32job.QueryInformationJobObject(job, win32job.JobObjectExtendedLimitInformation)
        limits["BasicLimitInformation"]["LimitFlags"] = win32job.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        win32job.SetInformationJobObject(job, win32job.JobObjectExtendedLimitInformation, limits)
        win32job.AssignProcessToJobObject(job, win32api.GetCurrentProcess())
        _job.append(job)
        return

    def end_groups() -> None:
        for group in list(_running):
            try:
                os.killpg(group, signal.SIGKILL)
            except (ProcessLookupError, PermissionError):
                pass

    def stop(*_) -> None:
        end_groups()
        os._exit(0)

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    atexit.register(end_groups)


def _end_tree(process) -> None:
    if sys.platform == "win32":
        subprocess.run(["taskkill", "/T", "/F", "/PID", str(process.pid)], capture_output=True)
    else:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass


def _bounded(data: bytes) -> str:
    text = data.decode("utf-8", errors="replace")
    return text if len(text) <= OUTPUT_LIMIT else text[:OUTPUT_LIMIT // 2] + "\n…\n" + text[-OUTPUT_LIMIT // 2:]


async def _exited(process, seconds: float) -> bool:
    """Whether the command itself ended in time. Not process.wait(): on Python 3.12 that
    also waits for every process holding the output pipes to let go."""
    deadline = time.monotonic() + seconds
    while process.returncode is None:
        if time.monotonic() >= deadline:
            return False
        await asyncio.sleep(0.05)
    return True


@app.tool()
async def shell_run(command: str, timeoutSeconds: int = 60) -> dict:
    """Run one confirmed command in the workspace folder and report exactly what it printed."""
    if not WORKSPACE or not os.path.isdir(WORKSPACE):
        return {"refused": "no_workspace"}
    started = time.monotonic()
    # Async, so the worker keeps reading its input: STOP (the gateway closing it) ends the
    # worker at once, and the command's process tree with it, instead of after the command.
    process = await asyncio.create_subprocess_exec(
        *_shell(command), cwd=WORKSPACE, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        start_new_session=sys.platform != "win32",
        creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
    )
    if sys.platform != "win32":
        _running.add(process.pid)  # its own session: group id == pid
    output = asyncio.ensure_future(process.communicate())
    held = False
    try:
        timed_out = not await _exited(process, timeoutSeconds)
        if not timed_out:
            try:  # the command ended; something it started may still hold its output open
                await asyncio.wait_for(asyncio.shield(output), 2)
            except asyncio.TimeoutError:
                held = True
        if timed_out or held:
            _end_tree(process)
        out, err = await output
    finally:
        if process.returncode is None:
            _end_tree(process)  # cancelled by STOP
        _running.discard(process.pid)
    return {
        "exitCode": None if timed_out else process.returncode,
        "timedOut": timed_out,
        # Ended with the command: a program left running must be started detached, its output redirected.
        **({"outputHeldOpen": True} if held else {}),
        "stdout": _bounded(out),
        "stderr": _bounded(err),
        "seconds": round(time.monotonic() - started, 2),
    }


if __name__ == "__main__":
    _contain_children()
    app.run("stdio")
