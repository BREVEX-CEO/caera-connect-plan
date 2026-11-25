#!/usr/bin/env python3
"""Local, incremental OCADE code intelligence. No model calls or source execution."""
import argparse
import ast
from collections import Counter, defaultdict, deque
from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
import posixpath
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "CODEMAP.md"
START, END = "<!-- OVERVIEW:START -->", "<!-- OVERVIEW:END -->"
SKIP_DIRS = {"node_modules", "dist", "build", ".next", "vendor", "venv", ".venv", "__pycache__", "coverage", "target", ".git", "evidence", ".agents", ".codex", ".source-research"}
SKIP_FILES = {"package-lock.json", "yarn.lock", "pnpm-lock.yaml", "poetry.lock", "Cargo.lock", "go.sum", "install-kit.sh", "CODEMAP.md", ".env", ".dev.vars"}
TS = {".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"}
EXT = TS | set(".py .sql .sh .css .html .ps1 .iss .spec .json .yml .yaml .toml .ini .cfg .md .go .rs .java .kt .rb .php .cs .swift .c .h .cpp .hpp .vue .svelte .dart .scala".split())
SPECIAL = {"Dockerfile", "Makefile", ".gitignore", ".gitattributes", ".prettierignore", ".env.example"}
TEST = re.compile(r"(^|/)(tests?|__tests__)(/|$)|\.(test|spec)\.")
# Use the project's already installed TypeScript compiler. Parse syntax, never execute source.
TS_WORKER = r'''
const ts = require("typescript"), fs = require("node:fs");
const input = JSON.parse(fs.readFileSync(0, "utf8"));
const output = {};
for (const [path, text] of Object.entries(input)) {
  const src = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const facts = [], add = (kind, name, n, detail = "") => {
    if (name) facts.push([kind, name, src.getLineAndCharacterOfPosition(n.getStart(src)).line + 1, detail]);
  };
  const literal = n => n && ts.isStringLiteralLike(n) ? n.text : "";
  const nameOf = n => n && (ts.isIdentifier(n) || ts.isStringLiteralLike(n)) ? n.text : "";
  const callee = n => ts.isIdentifier(n) ? n.text : ts.isPropertyAccessExpression(n) ? (callee(n.expression) ? callee(n.expression) + "." + n.name.text : n.name.text) : "";
  function walk(n, scope = "") {
    let next = scope;
    if (ts.isImportDeclaration(n) && literal(n.moduleSpecifier)) {
      const m = literal(n.moduleSpecifier), c = n.importClause;
      if (!c) add("import", m, n, m + "#");
      else {
        if (c.name) add("import", c.name.text, n, m + "#default");
        if (c.namedBindings) {
          if (ts.isNamespaceImport(c.namedBindings)) add("import", c.namedBindings.name.text, n, m + "#*");
          else for (const e of c.namedBindings.elements) add("import", e.name.text, e, m + "#" + (e.propertyName || e.name).text);
        }
      }
    }
    if (ts.isExportDeclaration(n) && !literal(n.moduleSpecifier) && n.exportClause && ts.isNamedExports(n.exportClause)) {
      for (const e of n.exportClause.elements) add("export", e.name.text, e, (e.propertyName || e.name).text);
    }
    if (ts.isExportAssignment(n)) add("export", "default", n, nameOf(n.expression));
    if (ts.isExportDeclaration(n) && literal(n.moduleSpecifier)) {
      const m = literal(n.moduleSpecifier);
      if (n.exportClause && ts.isNamedExports(n.exportClause)) for (const e of n.exportClause.elements) add("reexport", e.name.text, e, m + "#" + (e.propertyName || e.name).text);
      else add("reexport", "*", n, m + "#*");
    }
    if (ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n) || ts.isMethodDeclaration(n) || ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n) || ts.isEnumDeclaration(n) || ts.isVariableDeclaration(n)) {
      const name = nameOf(n.name);
      if (name) {
        next = scope ? scope + "." + name : name;
        const kind = ts.isClassDeclaration(n) ? "class" : ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n) || (ts.isVariableDeclaration(n) && n.initializer && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))) ? "function" : "symbol";
        add(kind, next, n);
        const decl = ts.isVariableDeclaration(n) ? n.parent.parent : n;
        if ((decl.modifiers || []).some(m => m.kind === ts.SyntaxKind.ExportKeyword)) add("export", (decl.modifiers || []).some(m => m.kind === ts.SyntaxKind.DefaultKeyword) ? "default" : name, n, next);
        if (ts.isClassDeclaration(n)) for (const h of n.heritageClauses || []) for (const t of h.types) add("inherits", callee(t.expression), t, next);
      }
    }
    if (ts.isCallExpression(n)) {
      const c = callee(n.expression), arg = literal(n.arguments[0]);
      if (n.expression.kind === ts.SyntaxKind.ImportKeyword && arg) add("import", arg, n, arg + "#");
      else if (c) add("call", c, n, scope || "<module>");
      if (arg && /(?:^|\.)(from|rpc)$/.test(c)) add(c.endsWith("rpc") ? "rpc" : "table-use", arg, n, scope);
      if (arg && /(?:^|\.)(createFileRoute|createRoute|createRootRoute)$/.test(c)) add("route", arg, n);
      if (/(?:^|\.)createServerFn$/.test(c)) add("security", "server-function", n, scope);
    }
    ts.forEachChild(n, child => walk(child, next));
  }
  walk(src);
  output[path] = {parser: src.parseDiagnostics.length ? "typescript-partial" : "typescript-ast", facts};
}
process.stdout.write(JSON.stringify(output));
'''


def git(*args, timeout=15):
    return subprocess.run(["git", *args], cwd=ROOT, check=True, capture_output=True,
                          timeout=timeout, env={**os.environ, "GIT_TERMINAL_PROMPT": "0"}).stdout


def git_path(name):
    return ROOT / os.fsdecode(git("rev-parse", "--git-path", name).rstrip(b"\n"))


@contextmanager
def map_lock():
    with git_path("codemap.lock").open("a+b") as stream:
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


def atomic(path, text):
    if path.is_symlink():
        raise ValueError("Refusing symlink output")
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", newline="\n", dir=path.parent, prefix=".codemap-", suffix=".tmp", delete=False) as stream:
        stream.write(text)
        tmp = Path(stream.name)
    try:
        os.replace(tmp, path)
    finally:
        tmp.unlink(missing_ok=True)


def names():
    paths = {os.fsdecode(p) for p in git("ls-files", "-z", "--cached", "--others", "--exclude-standard").split(b"\0") if p}
    for name in sorted(paths):
        p = Path(name)
        if p.name in SKIP_FILES or SKIP_DIRS.intersection(p.parts[:-1]):
            continue
        if p.name.startswith(".env.") and p.name != ".env.example":
            continue
        if p.suffix.lower() not in EXT and p.name not in SPECIAL:
            continue
        path = ROOT / p
        if path.is_file() and not any(q.is_symlink() for q in (path, *[ROOT.joinpath(*p.parts[:i]) for i in range(1, len(p.parts))])):
            yield name, path


def py_facts(text):
    facts = []
    def visit(n, scope=""):
        def add(kind, name, detail=""):
            if name:
                facts.append([kind, name, n.lineno, detail])
        def dotted(e):
            if isinstance(e, ast.Name):
                return e.id
            if isinstance(e, ast.Attribute):
                base = dotted(e.value)
                return base + "." + e.attr if base else ""
            return ""
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            scope = ".".join(filter(None, (scope, n.name)))
            add("class" if isinstance(n, ast.ClassDef) else "function", scope)
            if isinstance(n, ast.ClassDef):
                for base in n.bases:
                    add("inherits", dotted(base), scope)
        elif isinstance(n, ast.Import):
            for a in n.names:
                add("import-py", a.asname or a.name.split(".")[0], a.name + "#*")
        elif isinstance(n, ast.ImportFrom):
            for a in n.names:
                add("import-py", a.asname or a.name, "." * n.level + (n.module or "") + "#" + a.name)
        elif isinstance(n, ast.Call):
            add("call", dotted(n.func), scope or "<module>")
        for child in ast.iter_child_nodes(n):
            visit(child, scope)
    try:
        visit(ast.parse(text))
        return "python-ast", facts
    except SyntaxError as exc:
        return "python-partial", [["parse-error", "SyntaxError", exc.lineno or 1, ""]]


def sql_facts(text):
    # Historical migration evidence, not a live database schema. Regex is deliberately labeled.
    rules = [("table", r"\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?([\w.\"]+)"), ("db-function", r"\bcreate\s+(?:or\s+replace\s+)?function\s+([\w.\"]+)"), ("policy", r"\bcreate\s+policy\s+(.+?)\s+on\s+([\w.\"]+)"), ("rls", r"\balter\s+table\s+(?:only\s+)?([\w.\"]+)\s+enable\s+row\s+level\s+security"), ("references", r"\breferences\s+([\w.\"]+)")]
    text = re.sub(r"/\*.*?\*/|--[^\n]*", lambda m: re.sub(r"[^\n]", " ", m[0]), text, flags=re.S)
    facts = []
    for kind, pattern in rules:
        for m in re.finditer(pattern, text, re.I):
            name = m[2] if kind == "policy" else m[1]
            detail = " ".join(m[1].split())[:120] if kind == "policy" else ""
            facts.append([kind, name.replace('"', '').lower(), text.count("\n", 0, m.start()) + 1, detail])
    return "sql-hints", facts


def parser_key():
    package = ROOT / "node_modules/typescript/package.json"
    available = package.is_file() or bool(os.environ.get("NODE_PATH"))
    key = hashlib.sha256(Path(__file__).read_bytes() + (package.read_bytes() if package.is_file() else b"") + str((shutil.which("node"), os.environ.get("NODE_PATH"), sys.version)).encode()).hexdigest()
    return key, available and bool(shutil.which("node"))


def load_cache(path, key):
    if path.is_symlink():
        raise ValueError("Refusing symlink cache")
    try:
        state = json.loads(path.read_text(encoding="utf-8"))
        if state.get("key") == key and isinstance(state.get("files"), dict):
            return state["files"]
    except (OSError, ValueError, AttributeError):
        pass
    return {}


def index(full=False, check=False, require_ast=False):
    head = git("rev-parse", "HEAD").decode().strip()
    path = git_path("codemap-v2.json")
    key, ts_ready = parser_key()
    prior = load_cache(path, key)
    files, pending, changed, read = {}, {}, 0, 0
    for name, p in names():
        st = p.stat()
        stamp = [st.st_size, st.st_mtime_ns, st.st_ctime_ns, st.st_ino, st.st_dev]
        prev = prior.get(name, {})
        if not full and prev.get("stamp") == stamp and "facts" in prev:
            files[name] = prev
            continue
        raw = p.read_bytes()
        read += len(raw)
        digest = hashlib.sha256(raw).hexdigest()
        if prev.get("hash") == digest and "facts" in prev:
            files[name] = {**prev, "stamp": stamp}
            continue
        changed += 1
        text = raw.decode("utf-8", errors="replace")
        suffix = p.suffix.lower()
        record = {"stamp": stamp, "hash": digest, "lines": len(text.splitlines()), "parser": "file-only", "facts": []}
        if suffix == ".py":
            record["parser"], record["facts"] = py_facts(text)
        elif suffix == ".sql":
            record["parser"], record["facts"] = sql_facts(text)
        elif suffix in TS:
            record["parser"] = "typescript-unavailable"
            pending[name] = text
        files[name] = record
    if pending and ts_ready:
        result = subprocess.run(["node", "-e", TS_WORKER], cwd=ROOT, input=json.dumps(pending), text=True, capture_output=True, timeout=60, check=True)
        extracted = json.loads(result.stdout)
        if set(extracted) != set(pending):
            raise ValueError("Incomplete TypeScript extraction")
        for name, record in extracted.items():
            files[name].update(record)
    if require_ast and any(f["parser"].startswith("typescript-") and f["parser"] != "typescript-ast" for f in files.values()):
        raise ValueError("Incomplete TypeScript AST coverage")
    # Hash the full indexed content, not just Git status; --check forces fresh reads.
    fp = hashlib.sha256(head.encode() + b"\0")
    for name, record in files.items():
        fp.update(os.fsencode(name) + b"\0" + bytes.fromhex(record["hash"]))
    if not check and files != prior:
        atomic(path, json.dumps({"key": key, "files": files}, ensure_ascii=True, separators=(",", ":")))
    return head, fp.hexdigest(), files, {"parsed": changed, "reused": len(files) - changed, "read_bytes": read, "deleted": len(prior.keys() - files.keys())}


def resolve(name, module, files, python=False, imported=""):
    if python:
        if module.startswith("."):
            level = len(module) - len(module.lstrip("."))
            base = posixpath.dirname(name)
            for _ in range(level - 1):
                base = posixpath.dirname(base)
            target = posixpath.join(base, module[level:].replace(".", "/"))
        else:
            target = module.replace(".", "/")
        options = [target + ".py", target + "/__init__.py"]
        if imported not in ("", "*"):
            options += [posixpath.join(target, imported) + ".py"]
        if not module.startswith("."):
            options += [p for p in files if p.endswith("/" + target + ".py") or p.endswith("/" + target + "/__init__.py")]
    else:
        if module.startswith("@/"):
            target = "src/" + module[2:]
        elif module.startswith("."):
            target = posixpath.normpath(posixpath.join(posixpath.dirname(name), module))
        else:
            return None
        root, ext = posixpath.splitext(target)
        options = [target] + [target + e for e in sorted(TS)] + [target + "/index" + e for e in sorted(TS)]
        if ext in {".js", ".mjs", ".cjs"}:
            options += [root + e for e in (".ts", ".tsx", ".mts", ".cts")]
    found = list(dict.fromkeys(p for p in options if p in files))
    return found[0] if len(found) == 1 else None


def relationships(files):
    edges, forward, reverse = defaultdict(list), defaultdict(set), defaultdict(set)
    db = defaultdict(set)
    for name, record in files.items():
        for kind, symbol, _, _ in record["facts"]:
            if kind in ("table", "db-function"):
                db[(kind, symbol.rsplit(".", 1)[-1])].add(name)
    def edge(src, target, kind, line, label):
        edges[src].append((kind, target, line, label))
        if target != src:
            forward[src].add(target)
            reverse[target].add(src)
    for name, record in files.items():
        bindings = defaultdict(set)
        for kind, symbol, line, detail in record["facts"]:
            if kind in ("import", "import-py", "reexport"):
                module, _, original = detail.rpartition("#")
                target = resolve(name, module, files, kind == "import-py", original)
                if target:
                    edge(name, target, kind, line, symbol + " => " + original + " [RESOLVED MODULE]")
                    bindings[symbol].add((target, original))
        for kind, symbol, line, detail in record["facts"]:
            if kind in ("call", "inherits"):
                root, _, rest = symbol.partition(".")
                if len(bindings[root]) == 1:
                    target, original = next(iter(bindings[root]))
                    edge(name, target, kind, line, detail + " => " + (rest if original == "*" else original + ("." + rest if rest else "")) + " [INFERRED]")
            elif kind in ("rpc", "table-use", "policy", "rls", "references"):
                for target in sorted(db[("db-function" if kind == "rpc" else "table", symbol.rsplit(".", 1)[-1])]):
                    edge(name, target, kind, line, symbol + " [SCHEMA HINT]")
    return edges, forward, reverse


def is_security(path):
    return path.endswith(".server.ts") or path.startswith("supabase/functions/") or bool(re.search(r"(^|[/_.-])(auth|security|permission|policy|rls|authority)([/_.-]|$)", path))


def cycles(forward):
    # Iterative DFS; report back-edge cycle witnesses, not all possible cycles.
    done, active, found = set(), {}, []
    for start in sorted(forward):
        if start in done:
            continue
        stack = [(start, iter(sorted(forward[start])))]; active[start] = 0
        while stack:
            node, children = stack[-1]
            child = next(children, None)
            if child is None:
                stack.pop(); active.pop(node); done.add(node)
            elif child in active:
                found.append([n for n, _ in stack[active[child]:]] + [child])
            elif child not in done:
                active[child] = len(stack); stack.append((child, iter(sorted(forward[child]))))
    return found


def fact_line(path, fact):
    kind, name, line, detail = fact
    return f"{kind.upper()} {name} | {path}:{line}" + (" | " + detail if detail else "")


def edge_line(path, e):
    kind, target, line, label = e
    return f"EDGE {kind} | {path}:{line} => {target} | {label}"


def summary(head, files, edges, reverse, found):
    counts = Counter(f["parser"] for f in files.values())
    lines = [f"CodeMap 2.0 | HEAD {head[:12]} | {len(files)} files | {sum(map(len, edges.values()))} static edges", "Search first: python3 scripts/codemap.py --query 'task or symbol' (or --trace, --impact, --tests, --security, --related, --path A B). Never read the complete map; verify source before edits.", "Coverage: " + ", ".join(f"{k}={v}" for k, v in sorted(counts.items())), "Relationships: imports resolved by path; calls and SQL hints are inferred, not runtime proof. Dynamic dispatch and unsupported languages may be incomplete."]
    roots = Counter(p.split("/")[0] for p in files if "/" in p)
    lines.append("Areas: " + ", ".join(f"{k} ({v})" for k, v in roots.most_common(12)))
    routes = [fact_line(p, f) for p, r in files.items() for f in r["facts"] if f[0] == "route"]
    lines += [f"Routes ({len(routes)} detected):", *routes[:12], f"Dependency cycle witnesses: {len(found)}; search the map for CYCLE.", "Most referenced files:", *[f"{p} ({len(reverse[p])} incoming files)" for p in sorted(reverse, key=lambda p: (-len(reverse[p]), p))[:8]]]
    return "\n".join(lines)[:4200]


def render(head, fp, files, old, edges, forward, reverse, found):
    overview = f"{START}\n## Overview\nOCADE source navigation: frontend, Supabase backend and device agents. Use the query engine for exact indexed references; verify actual code and tests.\n{END}"
    start, end = old.find(START), old.find(END)
    if 0 <= start < end and "Not written yet" not in old[start:end]:
        overview = old[start:end + len(END)]
    body = ["# CODEMAP", f"Source HEAD: `{head}`", f"Indexed content SHA-256: `{fp}`", "## Summary", summary(head, files, edges, reverse, found), overview, "## Detailed index (search, do not read in full)"]
    for name, record in files.items():
        syms = [f[1] for f in record["facts"] if f[0] in ("function", "class", "symbol")]
        body.append(f"FILE {name} ({record['lines']}L) [{record['parser']}]" + (" | " + ", ".join(syms[:3]) if syms else ""))
        if TEST.search(name):
            body.append(f"TEST {name}")
        if is_security(name):
            body.append(f"SECURITY {name} [PATH HINT]")
        body.extend(fact_line(name, f) for f in record["facts"])
        body.extend(edge_line(name, e) for e in edges[name])
    body.extend("CYCLE " + " => ".join(c) for c in found)
    return "\n".join(body) + "\n"


def words(s):
    return set(re.findall(r"[a-z0-9]+", re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", s).lower())) - {"py", "ts", "tsx", "js", "jsx", "sql", "md", "json", "the", "a", "in", "of", "for", "to"}


def match_score(query, label):
    q, s = query.casefold(), label.casefold()
    return (100 if q == s else 35 if q in s else 0) + 5 * len(words(query) & words(label))


def ranked(query, files):
    matches = []
    for path, record in files.items():
        score = match_score(query, path)
        if score:
            matches.append((score, path, f"FILE {path}"))
        for fact in record["facts"]:
            score = match_score(query, fact[1])
            if score:
                score += 15 if fact[0] in ("function", "class", "symbol", "table", "db-function") else 0
                matches.append((score, path, fact_line(path, fact)))
    return sorted(matches, key=lambda x: (-x[0], x[1], x[2]))


def walk(start, links, depth=3):
    seen, queue = set(start), deque((p, 0) for p in start)
    while queue:
        p, d = queue.popleft()
        if d == depth:
            continue
        for target in sorted(links.get(p, ())):
            if target not in seen:
                seen.add(target); queue.append((target, d + 1)); yield target


def query_result(mode, query, files, edges, forward, reverse, destination=None):
    hits = ranked(query, files)
    if not hits:
        return ["No indexed matches; use targeted source search. This does not establish absence."]
    top = list(dict.fromkeys(p for score, p, _ in hits if score == hits[0][0]))[:12]
    out = [f"CodeMap {mode}: {query} | static evidence; verify source | {len(hits)} matches"]
    if mode == "path":
        target = ranked(destination, files)
        if not target:
            return out + ["Destination not indexed."]
        goals = {p for score, p, _ in target if score == target[0][0]}
        queue, seen = deque((p, [p]) for p in top), set(top)
        while queue:
            p, chain = queue.popleft()
            if p in goals:
                return out + ["Dependency path (import/schema/inferred call edges): " + " => ".join(chain)]
            for nxt in sorted(forward.get(p, ())):
                if nxt not in seen:
                    seen.add(nxt); queue.append((nxt, chain + [nxt]))
        return out + ["No directed indexed path found; dynamic relationships may be missing."]
    out += [line for _, _, line in hits[:(5 if mode in ("tests", "impact", "security") else 12)]]
    if mode in ("trace", "query", "related", "security"):
        for p in top:
            out.extend(edge_line(p, e) for e in edges.get(p, ()) if mode != "security" or is_security(e[1]) or e[0] in ("rpc", "policy", "rls", "table-use"))
            for src in sorted(reverse.get(p, ())):
                out.extend(edge_line(src, e) for e in edges[src] if e[1] == p and (mode != "security" or is_security(src)))
    if mode in ("impact", "tests", "related", "security"):
        affected = list(walk(top, reverse))
        if mode in ("related", "security"):
            affected += list(walk(top, forward, 2))
        out += [f"{mode.upper()} {p} [STATIC CANDIDATE]" for p in dict.fromkeys(top + affected) if (mode != "tests" or TEST.search(p)) and (mode != "security" or is_security(p))]
    if mode in ("trace", "query", "related", "security"):
        # Exact symbol edges before unrelated edges from a large file.
        start = next((i for i, line in enumerate(out) if line.startswith("EDGE ")), len(out))
        out[start:] = sorted(out[start:], key=lambda line: (0 if line.startswith(mode.upper() + " ") else 1, -match_score(query, line), line))
    return list(dict.fromkeys(out))


def bounded(lines, budget):
    # Character bound, not a claim about exact tokenizer counts.
    cap = budget * 3
    marker = "\n[output truncated; narrow the query]"
    output = "\n".join(lines)
    if len(output) <= cap:
        return output
    prefix = output[:cap - len(marker)]
    return (prefix.rsplit("\n", 1)[0] if "\n" in prefix else prefix) + marker


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
    group = parser.add_mutually_exclusive_group()
    for mode in ("query", "search", "trace", "impact", "tests", "security", "related", "explain"):
        group.add_argument("--" + mode)
    group.add_argument("--path", nargs=2)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--remote", action="store_true")
    parser.add_argument("--summary", action="store_true")
    parser.add_argument("--stats", action="store_true")
    parser.add_argument("--require-ast", action="store_true")
    parser.add_argument("--before-read", action="store_true")
    parser.add_argument("--guard-read", action="store_true")
    parser.add_argument("--budget", type=int, default=650, choices=range(50, 4001), metavar="50..4000")
    args = parser.parse_args()
    try:
        if args.before_read or args.guard_read:
            event = json.load(sys.stdin)
            tool = event.get("tool_input", {})
            path = tool.get("file_path", "")
            if not path or (ROOT / path).resolve() != OUT:
                return 0
            if args.guard_read and (not isinstance(tool.get("limit"), int) or not 1 <= tool["limit"] <= 120):
                print("Use python3 scripts/codemap.py --query 'symbol or task' or request a bounded Read (limit <= 120). Do not load the full map.", file=sys.stderr)
                return 2
        if OUT.is_symlink():
            raise ValueError("Refusing symlink CODEMAP.md")
        with map_lock():
            head, fp, files, stats = index(full=args.check, check=args.check, require_ast=args.require_ast)
            edges, forward, reverse = relationships(files)
            found = cycles(forward)
            old = OUT.read_text(encoding="utf-8") if OUT.exists() else ""
            # A warm query still rebuilds derived edges from cached facts; no source parsing.
            output = render(head, fp, files, old, edges, forward, reverse, found)
            if old != output:
                if args.check:
                    print("CodeMap missing or stale; run python3 scripts/codemap.py.", file=sys.stderr)
                    return 1
                atomic(OUT, output)
            if args.check:
                print(f"CodeMap current: {head[:12]}, {len(files)} indexed files.")
            if args.summary:
                print(summary(head, files, edges, reverse, found))
            if args.stats:
                print(json.dumps(stats, sort_keys=True))
            for mode in ("query", "search", "trace", "impact", "tests", "security", "related", "explain", "path"):
                value = getattr(args, mode)
                if value:
                    q, dest = value if mode == "path" else (value, None)
                    print(bounded(query_result("query" if mode in ("search", "explain") else mode, q, files, edges, forward, reverse, dest), args.budget))
        upstream = remote_status(head, args.check) if args.remote else True
        return 0 if upstream or not args.check else 1
    except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError) as exc:
        print(f"codemap: {type(exc).__name__}: refresh failed", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
