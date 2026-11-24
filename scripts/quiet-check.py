#!/usr/bin/env python3
"""Run an argv command, preserve its real exit code, and keep a local diagnostic log."""
import os, re, subprocess, sys, tempfile
from pathlib import Path

args = sys.argv[1:]
if args and args[0] == "--":
    args = args[1:]
if not args:
    sys.exit("usage: quiet-check.py -- executable [args ...]")
try:
    git_dir = subprocess.check_output(["git", "rev-parse", "--absolute-git-dir"], text=True).strip()
    logdir = Path(git_dir) / "ocade-check-logs"
    logdir.mkdir(mode=0o700, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix="check-", suffix=".log", dir=logdir)
    with os.fdopen(fd, "wb") as log:
        try:
            result = subprocess.run(args, stdout=log, stderr=subprocess.STDOUT, check=False)
            rc = result.returncode
        except OSError as exc:
            log.write(str(exc).encode("utf-8", "replace"))
            rc = 127
    print(f"exit={rc}; local log={name}")
    if rc != 0:
        print("Command failed. Inspect the local log selectively; redact secrets before sharing.", file=sys.stderr)
    else:
        print("Command exited successfully; verify test counts and real acceptance evidence separately.")
    sys.exit(rc if rc >= 0 else 128 - rc)
except OSError as exc:
    print(f"quiet-check infrastructure error: {exc}", file=sys.stderr)
    sys.exit(1)
