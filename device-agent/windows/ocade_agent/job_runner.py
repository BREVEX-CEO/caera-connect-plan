"""Runs one job (see `jobs.py`): start the command, enforce its deadline, honour `cancel`,
record how it ended. Started detached by the shell worker; never talks to the server."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path

from .jobs import _write, end_tree, process_start


def main() -> None:
    here = Path(os.environ["OCADE_JOB"])
    spec = json.loads((here / "spec.json").read_text())
    with open(here / "output.log", "wb") as log:
        try:
            command = subprocess.Popen(
                spec["argv"], cwd=spec["cwd"], stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT,
                start_new_session=sys.platform != "win32",
                creationflags=(subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW)
                if sys.platform == "win32" else 0,
            )
        except OSError as error:
            _write(here / "exit.json", {"state": "failed_to_start", "exitCode": None, "error": error.strerror,
                                        "ended": time.time()})
            return
        _write(here / "runner.json", {
            "runner": os.getpid(), "runnerStart": process_start(os.getpid()),
            "command": command.pid, "commandStart": process_start(command.pid),
        })
        state = "finished"
        while command.poll() is None:
            if (here / "cancel").exists():
                state = "cancelled"
            elif time.time() > spec["deadline"]:
                state = "timed_out"
            if state != "finished":
                end_tree(command.pid)
                command.wait()
                break
            time.sleep(0.25)
    _write(here / "exit.json", {"state": state, "exitCode": command.returncode if state == "finished" else None,
                                "ended": time.time()})


if __name__ == "__main__":
    main()
