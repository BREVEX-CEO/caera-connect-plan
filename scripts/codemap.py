#!/usr/bin/env python3
"""Write CODEMAP.md: one line per source file with its purpose and top-level symbols.
Stdlib only, no LLM tokens. Keeps the hand-written block between the OVERVIEW markers."""
import os, re, subprocess, sys

OUT = "CODEMAP.md"
START, END = "<!-- OVERVIEW:START -->", "<!-- OVERVIEW:END -->"
MAX_SYMS = 6
DATA_EXT = {".sql", ".json", ".md", ".txt", ".csv", ".yml", ".yaml", ".png", ".svg"}
COLLAPSE_AT = 12
SKIP_DIRS = ("node_modules/", "dist/", "build/", ".next/", "vendor/", "venv/", ".venv/",
             "__pycache__/", "coverage/", "target/", ".git/", "evidence/",
             ".claude/skills/", ".agents/", ".codex/", "public/")
SKIP_FILES = ("package-lock.json", "yarn.lock", "pnpm-lock.yaml", "poetry.lock",
              "Cargo.lock", "go.sum", "install-kit.sh", OUT)
CODE_EXT = {".py", ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".go", ".rs", ".java",
            ".kt", ".rb", ".php", ".cs", ".swift", ".c", ".h", ".cpp", ".hpp", ".vue",
            ".svelte", ".sh", ".sql", ".dart", ".scala"}
CONF_EXT = {".json", ".yml", ".yaml", ".toml", ".ini", ".cfg", ".env.example", ".md"}

SYM = re.compile(
    r"^(?:export\s+(?:default\s+)?)?(?:async\s+)?"
    r"(?:def|class|function|interface|type|enum|struct|trait|impl|func|fn|pub\s+fn|pub\s+struct|module)\s+"
    r"([A-Za-z_][\w]*)"
    r"|^(?:export\s+)?const\s+([A-Za-z_]\w*)\s*=\s*(?:async\s*)?(?:\(|function|[A-Za-z_]\w*\s*=>)"
    r"|^(?:public|private|protected)?\s*(?:static\s+)?(?:class|interface|enum)\s+([A-Za-z_]\w*)")
ROUTE = re.compile(r"""\b(?:app|router|bp|api|server|blueprint)\.(?:get|post|put|patch|delete|route)\(\s*['"](/[^'"]*)""")
COMMENT = re.compile(r'^\s*(?:#|//|/\*+|\*|"""|\'\'\'|--)\s*(.+?)\s*(?:\*/|"""|\'\'\')?\s*$')


def files():
    try:
        out = subprocess.run(["git", "ls-files", "--cached", "--others", "--exclude-standard"], capture_output=True, text=True, check=True).stdout
        paths = out.splitlines()
    except Exception:
        paths = [os.path.relpath(os.path.join(r, f)) for r, _, fs in os.walk(".") for f in fs]
    keep = []
    for p in paths:
        if not os.path.isfile(p) or os.path.islink(p):
            continue
        p = p.replace("\\", "/")
        if any(d in "/" + p for d in ("/" + s for s in SKIP_DIRS)) or os.path.basename(p) in SKIP_FILES:
            continue
        ext = os.path.splitext(p)[1].lower()
        if ext in CODE_EXT or ext in CONF_EXT or os.path.basename(p) in ("Dockerfile", "Makefile"):
            keep.append(p)
    return sorted(set(keep), key=lambda p: (os.path.dirname(p), os.path.basename(p)))


def describe(path):
    try:
        with open(path, encoding="utf-8", errors="ignore") as f:
            lines = f.read(200_000).splitlines()
    except OSError:
        return "", [], 0
    purpose = ""
    for ln in lines[:15]:
        if ln.startswith("#!") or not ln.strip():
            continue
        m = COMMENT.match(ln)
        if m and len(m.group(1)) > 8 and not m.group(1).lower().startswith(("eslint", "type:", "@ts-", "-*-")):
            purpose = m.group(1)[:70]
            break
        if not m:
            break
    if path.endswith(".md") and not purpose:
        purpose = next((l.lstrip("# ").strip()[:90] for l in lines if l.startswith("#")), "")
    syms, routes = [], []
    if os.path.splitext(path)[1].lower() in CODE_EXT:
        for ln in lines:
            m = SYM.match(ln)
            if m:
                name = next(g for g in m.groups() if g)
                if name not in syms and name not in ("and", "or", "the", "to", "for", "is"):
                    syms.append(name)
            routes += ROUTE.findall(ln)
    return purpose, syms + [f"route {r}" for r in routes[:4]], len(lines)


def main():
    old_overview = (f"{START}\n## Overview\n_Not written yet. Ask Claude to run /codemap to fill this in "
                    f"(stack, how to run/test, architecture, conventions)._\n{END}")
    if os.path.exists(OUT):
        txt = open(OUT, encoding="utf-8").read()
        if START in txt and END in txt:
            old_overview = txt[txt.index(START): txt.index(END) + len(END)]
    paths = files()
    by_dir = {}
    for p in paths:
        by_dir.setdefault(os.path.dirname(p) or ".", []).append(p)
    body = []
    for d, ps in by_dir.items():
        body.append(f"\n### {d}/")
        names = [os.path.basename(p) for p in ps]
        is_data = all(os.path.splitext(n)[1].lower() in DATA_EXT for n in names)
        is_test = all(re.search(r"(^|/)(tests?|__tests__)(/|$)|\.(test|spec)\.", p) for p in ps)
        if (is_data or is_test) and len(ps) > COLLAPSE_AT:
            body.append(f"- {len(ps)} {'test' if is_test else 'data'} files: {names[0]} ... {names[-1]}")
            continue
        if is_test:
            body.append("- tests: " + ", ".join(names))
            continue
        for p in ps:
            purpose, syms, n = describe(p)
            extra = ", ".join(syms[:MAX_SYMS]) + (f" +{len(syms) - MAX_SYMS}" if len(syms) > MAX_SYMS else "")
            line = f"- `{os.path.basename(p)}` ({n}L)"
            if purpose:
                line += f" {purpose.rstrip()}"
            if extra:
                line += f" | {extra}"
            body.append(line)
    out = "\n".join([
        "# CODEMAP",
        "Auto-generated file index. Read this instead of exploring the repo. "
        "Open a file only when you need its code.",
        "",
        old_overview,
        "",
        f"## Files ({len(paths)})",
        *body,
        "",
    ])
    if not os.path.exists(OUT) or open(OUT, encoding="utf-8").read() != out:
        with open(OUT, "w", encoding="utf-8") as f:
            f.write(out)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # never block a session
        print(f"codemap: {e}", file=sys.stderr)
    sys.exit(0)
