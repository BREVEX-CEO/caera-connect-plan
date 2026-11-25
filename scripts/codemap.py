#!/usr/bin/env python3
"""Refresh a deterministic local source index; never pull or modify tracked files."""
import argparse
from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "CODEMAP.md"
START, END = "<!-- OVERVIEW:START -->", "<!-- OVERVIEW:END -->"
MAX_SYMS, COLLAPSE_AT = 6, 12
DATA_EXT = {".sql", ".json", ".md", ".txt", ".csv", ".yml", ".yaml", ".png", ".svg"}
SKIP_DIRS = {"node_modules", "dist", "build", ".next", "vendor", "venv", ".venv", "__pycache__", "coverage", "target", ".git", "evidence", ".agents", ".codex", ".source-research"}
SKIP_FILES = {"package-lock.json", "yarn.lock", "pnpm-lock.yaml", "poetry.lock", "Cargo.lock", "go.sum", "install-kit.sh", "CODEMAP.md"}
CODE_EXT = set(".py .js .jsx .ts .tsx .mjs .cjs .go .rs .java .kt .rb .php .cs .swift .c .h .cpp .hpp .vue .svelte .sh .sql .dart .scala .css .html .ps1 .iss .spec".split())
CONF_EXT = {".json", ".yml", ".yaml", ".toml", ".ini", ".cfg", ".md"}
SPECIAL = {"Dockerfile", "Makefile", ".gitignore", ".gitattributes", ".prettierignore", ".env.example"}
SYM = re.compile(r"^(?:export\s+(?:default\s+)?)?(?:async\s+)?(?:def|class|function|interface|type|enum|struct|trait|impl|func|fn|pub\s+fn|pub\s+struct|module)\s+([A-Za-z_][\w]*)|^(?:export\s+)?const\s+([A-Za-z_]\w*)\s*=\s*(?:async\s*)?(?:\(|function|[A-Za-z_]\w*\s*=>)|^(?:public|private|protected)?\s*(?:static\s+)?(?:class|interface|enum)\s+([A-Za-z_]\w*)")
ROUTE = re.compile(r"""\b(?:app|router|bp|api|server|blueprint)\.(?:get|post|put|patch|delete|route)\(\s*['\"](/[^'\"]*)""")
COMMENT = re.compile(r'^\s*(?:#|//|/\*+|\*|"""|\'\'\'|--)\s*(.+?)\s*(?:\*/|"""|\'\'\')?\s*$')


def git(*args, timeout=15):
    return subprocess.run(["git", *args], cwd=ROOT, check=True, capture_output=True,
                          timeout=timeout, env={**os.environ, "GIT_TERMINAL_PROMPT": "0"}).stdout


def snapshot():
    head = git("rev-parse", "HEAD").decode().strip()
    names = {os.fsdecode(p) for p in git("ls-files", "-z", "--cached", "--others", "--exclude-standard").split(b"\0") if p}
    rows = []
    digest = hashlib.sha256(head.encode() + b"\0")
    for name in sorted(names, key=lambda p: (os.path.dirname(p), os.path.basename(p))):
        p = Path(name)
        if p.name in SKIP_FILES or SKIP_DIRS.intersection(p.parts[:-1]):
            continue
        if p.suffix.lower() not in CODE_EXT | CONF_EXT and p.name not in SPECIAL:
            continue
        path = ROOT / p
        if path.is_symlink() or not path.is_file():
            continue
        data = path.read_bytes()
        digest.update(os.fsencode(name) + b"\0" + hashlib.sha256(data).digest())
        rows.append((name, data))
    return head, digest.hexdigest(), rows


def describe(name, data):
    text = data.decode("utf-8", errors="replace")
    lines = text.splitlines()
    purpose = ""
    for line in lines[:15]:
        if line.startswith("#!") or not line.strip():
            continue
        m = COMMENT.match(line)
        if m and len(m.group(1)) > 8 and not m.group(1).lower().startswith(("eslint", "type:", "@ts-", "-*-")):
            purpose = m.group(1)[:70]
            break
        if not m:
            break
    if name.endswith(".md") and not purpose:
        purpose = next((l.lstrip("# ").strip()[:90] for l in lines if l.startswith("#")), "")
    syms, routes = [], []
    if Path(name).suffix.lower() in CODE_EXT:
        for line in lines:
            m = SYM.match(line)
            if m:
                symbol = next(g for g in m.groups() if g)
                if symbol not in syms and symbol not in ("and", "or", "the", "to", "for", "is"):
                    syms.append(symbol)
            routes.extend(ROUTE.findall(line))
    return purpose, syms + [f"route {r}" for r in routes[:4]], len(lines)


def render(head, fingerprint, rows, old):
    overview = f"{START}\n## Overview\n_Not written yet. Ask Claude to run /codemap to fill this in (stack, how to run/test, architecture, conventions)._\n{END}"
    start, end = old.find(START), old.find(END)
    if 0 <= start < end:
        overview = old[start:end + len(END)]
    by_dir = {}
    for name, data in rows:
        by_dir.setdefault(os.path.dirname(name) or ".", []).append((name, data))
    body = []
    for d, entries in by_dir.items():
        body.append(f"\n### {d}/")
        names = [os.path.basename(p) for p, _ in entries]
        is_data = all(Path(n).suffix.lower() in DATA_EXT for n in names)
        is_test = all(re.search(r"(^|/)(tests?|__tests__)(/|$)|\.(test|spec)\.", p) for p, _ in entries)
        if (is_data or is_test) and len(entries) > COLLAPSE_AT:
            body.append(f"- {len(entries)} {'test' if is_test else 'data'} files: {names[0]} ... {names[-1]}")
            continue
        if is_test:
            body.append("- tests: " + ", ".join(names))
            continue
        for name, data in entries:
            purpose, syms, n = describe(name, data)
            extra = ", ".join(syms[:MAX_SYMS]) + (f" +{len(syms) - MAX_SYMS}" if len(syms) > MAX_SYMS else "")
            body.append(f"- `{os.path.basename(name)}` ({n}L)" + (f" {purpose.rstrip()}" if purpose else "") + (f" | {extra}" if extra else ""))
    return "\n".join(["# CODEMAP", "Auto-generated local index; open real files to verify behavior.",
                      f"Source HEAD: `{head}`", f"Indexed content SHA-256: `{fingerprint}`", "", overview,
                      "", f"## Files ({len(rows)})", *body, ""])


@contextmanager
def map_lock():
    # Serialize parallel tool hooks per worktree. The lock is outside the index.
    path = ROOT / os.fsdecode(git("rev-parse", "--git-path", "codemap.lock").rstrip(b"\n"))
    with path.open("a+b") as stream:
        if os.name == "nt":
            import msvcrt
            stream.seek(0)
            if not stream.read(1):
                stream.write(b"\0")
                stream.flush()
            stream.seek(0)
            msvcrt.locking(stream.fileno(), msvcrt.LK_LOCK, 1)
        else:
            import fcntl
            fcntl.flock(stream.fileno(), fcntl.LOCK_EX)
        yield


def refresh(check):
    if OUT.is_symlink():
        raise ValueError("Refusing symlink CODEMAP.md")
    old = OUT.read_text(encoding="utf-8") if OUT.exists() else ""
    head, fingerprint, rows = snapshot()
    output = render(head, fingerprint, rows, old)
    if old == output:
        if check:
            print(f"CodeMap current: {head[:12]}, {len(rows)} indexed files.")
        return head, True
    if check:
        print("CodeMap missing or stale; run python3 scripts/codemap.py.", file=sys.stderr)
        return head, False
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", newline="\n", dir=ROOT, prefix=".codemap-", suffix=".tmp", delete=False) as stream:
        stream.write(output)
        temp = Path(stream.name)
    try:
        os.replace(temp, OUT)
    finally:
        temp.unlink(missing_ok=True)
    return head, True


def remote_status(head, verbose=False):
    try:
        branch = git("symbolic-ref", "--short", "HEAD").decode().strip()
        remote = git("config", "--get", f"branch.{branch}.remote").decode().strip()
        ref = git("config", "--get", f"branch.{branch}.merge").decode().strip()
        if remote not in git("remote").decode().splitlines() or not ref.startswith("refs/heads/"):
            raise ValueError("No configured remote branch")
        matches = git("ls-remote", "--exit-code", "--", remote, ref, timeout=5).decode().splitlines()
        remote_head, = [line.split()[0] for line in matches if line.split()[1:] == [ref]]
    except (OSError, ValueError, subprocess.SubprocessError):
        print("CodeMap: upstream status unavailable; local freshness only.")
        return False
    if remote_head != head:
        print(f"CodeMap: local HEAD {head[:12]} differs from upstream {remote_head[:12]}; synchronize safely before using remote changes. No pull performed.")
        return False
    if verbose:
        print(f"CodeMap: upstream matches local HEAD {head[:12]}.")
    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify without rewriting the map")
    parser.add_argument("--remote", action="store_true", help="Read-only upstream HEAD check; never pull")
    parser.add_argument("--before-read", action="store_true", help="Refresh only before Claude reads CODEMAP.md")
    args = parser.parse_args()
    try:
        if args.before_read:
            event = json.load(sys.stdin)
            path = event.get("tool_input", {}).get("file_path", "")
            if not path or Path(path).resolve() != OUT:
                return 0
        with map_lock():
            head, current = refresh(args.check)
        upstream = remote_status(head, args.check) if args.remote else True
        return 0 if current and (upstream or not args.check) else 1
    except (OSError, ValueError, subprocess.SubprocessError) as exc:
        print(f"codemap: {type(exc).__name__}: refresh failed", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
