"""Compile the control engine to bytecode for shipping.

WHAT BYTECODE COMPILATION IS AND IS NOT
---------------------------------------
It is NOT a protection boundary. `.pyc` files are a documented format, and
decompilers reconstruct readable source from them -- variable names and all,
because the names are stored in the file. Anyone who wants the logic will have
it. A build that ships `.pyc` and calls itself protected has bought a feeling.

It IS worth doing for two ordinary reasons. Startup: the interpreter compiles
every module on first import anyway, so shipping the result removes that work
from the user's first run rather than from ours. And tidiness: a customer
browsing the install directory finds a program, not an editable copy of the
source with comments explaining exactly which check to remove.

The real boundaries are elsewhere and are named in the licence: code signing,
the command allow-list, and the origin lock.

WHY SOURCE IS REMOVED SEPARATELY AND OPTIONALLY
-----------------------------------------------
Deleting the `.py` files makes tracebacks far less useful -- Python prints the
offending SOURCE LINE when it can find it, and without the file the user gets a
frame with no line. For a product that drives somebody's computer, a diagnosable
crash is worth more than a marginal inconvenience to a reader who has a
decompiler anyway. So `--strip-source` exists, defaults to off, and says this.

Usage:
    python scripts/build.py                 # compile in place, keep sources
    python scripts/build.py --strip-source  # compile, then remove .py files
    python scripts/build.py --check         # verify everything compiles; no writes
"""

from __future__ import annotations

import argparse
import compileall
import pathlib
import re
import shutil
import sys

REPO = pathlib.Path(__file__).resolve().parent.parent
ENGINE = REPO / "native" / "ocade_control_engine"

# Test files are not shipped, and neither is the cache of a previous run.
EXCLUDE = r"(_test\.py$|[\\/]tests?[\\/]|[\\/]__pycache__[\\/]|[\\/]\.venv[\\/])"


def compile_engine(*, quiet: bool) -> bool:
    """Compile every shipped module. Returns True when all of them compiled."""
    if not ENGINE.is_dir():
        print(f"error: engine directory not found at {ENGINE}", file=sys.stderr)
        return False

    # `legacy=False` writes to __pycache__, which is where the interpreter looks.
    # `quiet=1` prints only errors; a wall of filenames hides the one that failed.
    return bool(
        compileall.compile_dir(
            str(ENGINE),
            rx=re.compile(EXCLUDE),
            quiet=1 if quiet else 0,
            force=True,
            legacy=False,
            optimize=-1,
        )
    )


def strip_sources() -> int:
    """Remove shipped `.py` files whose bytecode exists. Returns the count.

    Only removes a source when its compiled form is actually present. Deleting a
    file whose bytecode failed to build would ship a module that cannot import at
    all -- a far worse outcome than a readable source file.
    """
    removed = 0
    for source in ENGINE.rglob("*.py"):
        text = str(source)
        if "__pycache__" in text or ".venv" in text or source.name.endswith("_test.py"):
            continue
        cached = source.parent / "__pycache__"
        if not cached.is_dir():
            continue
        stem = source.stem
        if any(p.name.startswith(f"{stem}.") and p.suffix == ".pyc" for p in cached.iterdir()):
            source.unlink()
            removed += 1
    return removed


def clean_caches() -> None:
    """Drop every __pycache__ under the engine, so --check starts honest."""
    for cache in ENGINE.rglob("__pycache__"):
        shutil.rmtree(cache, ignore_errors=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--strip-source",
        action="store_true",
        help="delete .py files after compiling (makes tracebacks less useful)",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="verify everything compiles, then remove what was written",
    )
    args = parser.parse_args()

    if args.check and args.strip_source:
        print("error: --check and --strip-source are contradictory", file=sys.stderr)
        return 2

    ok = compile_engine(quiet=not args.check)
    if not ok:
        print("build failed: at least one module did not compile", file=sys.stderr)
        return 1

    if args.check:
        clean_caches()
        print("all engine modules compile.")
        return 0

    print(f"compiled the control engine to bytecode under {ENGINE}")

    if args.strip_source:
        removed = strip_sources()
        print(f"removed {removed} source files whose bytecode was written")
        print(
            "note: tracebacks from the shipped engine will no longer show source "
            "lines. Keep this build's sources to interpret them."
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
