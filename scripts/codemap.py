#!/usr/bin/env python3
"""Local, incremental OCADE code intelligence. No model calls or source execution."""
import argparse
import ast
from collections import Counter, defaultdict, deque
from contextlib import contextmanager
from difflib import get_close_matches
from functools import lru_cache
from heapq import nlargest
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
import zlib

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
  const src = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, false);
  const counts = new Map();
  const facts = [], add = (kind, name, n, detail = "") => {
    if (name) facts.push([kind, name, src.getLineAndCharacterOfPosition(n.getStart(src)).line + 1, detail]);
  };
  const literal = n => n && ts.isStringLiteralLike(n) ? n.text : "";
  const nameOf = n => n && (ts.isIdentifier(n) || ts.isStringLiteralLike(n)) ? n.text : "";
  const callee = n => ts.isIdentifier(n) ? n.text : ts.isPropertyAccessExpression(n) ? (callee(n.expression) ? callee(n.expression) + "." + n.name.text : n.name.text) : "";
  function walk(n, scope = "", parent, grandparent) {
    if (ts.isIdentifier(n)) counts.set(n.text, (counts.get(n.text) || 0) + 1);
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
        const decl = ts.isVariableDeclaration(n) ? grandparent : n;
        if ((decl.modifiers || []).some(m => m.kind === ts.SyntaxKind.ExportKeyword)) add("export", (decl.modifiers || []).some(m => m.kind === ts.SyntaxKind.DefaultKeyword) ? "default" : name, n, next);
        if (ts.isClassDeclaration(n)) for (const h of n.heritageClauses || []) for (const t of h.types) add("inherits", callee(t.expression), t, next);
      }
    }
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      const tag = callee(n.tagName);
      if (/^[A-Z]/.test(tag)) add("component-use", tag, n, scope || "<module>");
    }
    if (ts.isCallExpression(n)) {
      const c = callee(n.expression), arg = literal(n.arguments[0]);
      if (n.expression.kind === ts.SyntaxKind.ImportKeyword && arg) add("import", arg, n, arg + "#");
      else if (c) add("call", c, n, scope || "<module>");
      if (arg && /(?:^|\.)(from|rpc)$/.test(c)) add(c.endsWith("rpc") ? "rpc" : "table-use", arg, n, scope);
      if (arg && /(?:^|\.)(createFileRoute|createRoute|createRootRoute)$/.test(c)) add("route", arg, n);
      if (/(?:^|\.)createServerFn$/.test(c)) add("security", "server-function", n, scope);
    }
    ts.forEachChild(n, child => walk(child, next, n, parent));
  }
  walk(src);
  if (ts.isExternalModule(src) && !src.parseDiagnostics.length) {
    for (const n of src.statements) {
      if (ts.isFunctionDeclaration(n) && n.name && counts.get(n.name.text) === 1 &&
          !(n.modifiers || []).some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
        add("unused-candidate", n.name.text, n, "Unreferenced module-private declaration; verify dynamic uses");
      }
    }
  }
  for (const issue of src.parseDiagnostics) {
    facts.push(["parse-error", "TS" + issue.code,
      src.getLineAndCharacterOfPosition(issue.start).line + 1,
      ts.flattenDiagnosticMessageText(issue.messageText, " ")]);
  }
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


def atomic(path, data):
    if path.is_symlink():
        raise ValueError("Refusing symlink output")
    with tempfile.NamedTemporaryFile(mode="wb", dir=path.parent, prefix=".codemap-", suffix=".tmp", delete=False) as stream:
        stream.write(data.encode("utf-8") if isinstance(data, str) else data)
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
        return "python-partial", [["parse-error", "SyntaxError", exc.lineno or 1, exc.msg]]


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
    node = shutil.which("node")
    if not package.is_file() and node and os.environ.get("NODE_PATH"):
        probe = subprocess.run([node, "-p", 'require.resolve("typescript/package.json")'],
                               cwd=ROOT, capture_output=True, text=True, timeout=5)
        if probe.returncode == 0:
            package = Path(probe.stdout.strip())
    installed = package.is_file()
    key = hashlib.sha256(Path(__file__).read_bytes() + (package.read_bytes() if installed else b"") + str((node, sys.version)).encode()).hexdigest()
    return key, installed and bool(node)


def load_cache(path, key):
    if path.is_symlink():
        raise ValueError("Refusing symlink cache")
    try:
        receipt, _, payload = path.read_bytes().partition(b"\n")
        if receipt != hashlib.sha256(payload).hexdigest().encode():
            return {}
        state = json.loads(zlib.decompress(payload))
        if state.get("key") == key and isinstance(state.get("files"), dict):
            files = state["files"]
            if all(isinstance(record, dict) and isinstance(record.get("facts"), list)
                   and isinstance(record.get("lines"), int) and isinstance(record.get("parser"), str)
                   and re.fullmatch(r"[0-9a-f]{64}", str(record.get("hash", "")))
                   for record in files.values()):
                return files
    except (OSError, ValueError, AttributeError, zlib.error):
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
        if not full and prev.get("hash") == digest and "facts" in prev:
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
        # The worker discards each syntax tree after extraction. A smaller V8
        # young generation reduces peak memory on cold scans of many files.
        result = subprocess.run(["node", "--max-semi-space-size=4", "-e", TS_WORKER],
                                cwd=ROOT, input=json.dumps(pending), text=True,
                                capture_output=True, timeout=60, check=True)
        extracted = json.loads(result.stdout)
        if set(extracted) != set(pending):
            raise ValueError("Incomplete TypeScript extraction")
        for name, record in extracted.items():
            files[name].update(record)
    if require_ast and any(f["parser"].startswith("typescript-") and f["parser"] != "typescript-ast" for f in files.values()):
        raise ValueError("Incomplete TypeScript AST coverage")
    # Hash the full indexed content, not just Git status; --check forces fresh reads.
    fp = hashlib.sha256((head + key).encode() + b"\0")
    for name, record in files.items():
        fp.update(os.fsencode(name) + b"\0" + bytes.fromhex(record["hash"]))
    if not check and (files != prior or not path.exists()):
        data = json.dumps({"key": key, "files": files}, ensure_ascii=True, separators=(",", ":"))
        payload = zlib.compress(data.encode(), level=1)
        atomic(path, hashlib.sha256(payload).hexdigest().encode() + b"\n" + payload)
    return head, fp.hexdigest(), files, {"parsed": changed, "reused": len(files) - changed, "read_bytes": read, "deleted": len(prior.keys() - files.keys())}


def resolve(name, module, files, python=False, imported="", python_suffixes=None):
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
            options += (python_suffixes or {}).get(target, ())
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


def local_definition(symbol, owner, definitions):
    if symbol.startswith(("self.", "this.")):
        scope = owner.rpartition(".")[0]
        if not scope:
            return None, None
        lookup = scope + "." + symbol.split(".", 1)[1]
        lines = definitions.get(lookup, ())
        return (lookup, next(iter(lines))) if len(lines) == 1 else (None, None)
    scope = owner
    while scope:
        lookup = scope + "." + symbol
        lines = definitions.get(lookup, ())
        if lines:
            return (lookup, next(iter(lines))) if len(lines) == 1 else (None, None)
        scope = scope.rpartition(".")[0]
    lines = definitions.get(symbol, ())
    return (symbol, next(iter(lines))) if len(lines) == 1 else (None, None)


def relationships(files):
    edges, forward, reverse = defaultdict(list), defaultdict(set), defaultdict(set)
    db = defaultdict(set)
    python_suffixes = defaultdict(list)
    for path in files:
        if path.endswith(".py"):
            stem = path.removesuffix("/__init__.py") if path.endswith("/__init__.py") else path[:-3]
            parts = stem.split("/")
            for i in range(1, len(parts)):
                python_suffixes["/".join(parts[i:])].append(path)
    exports = {p: {f[1] for f in r["facts"] if f[0] in ("export", "reexport")} for p, r in files.items()}
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
                target = resolve(name, module, files, kind == "import-py", original, python_suffixes)
                if target:
                    edge(name, target, kind, line, symbol + " => " + original + " [RESOLVED MODULE]")
                    if kind != "import-py" and original not in ("", "*", "default") and files[target]["parser"] == "typescript-ast" and not {original, "*"} & exports[target]:
                        edges[name].append(("diagnostic-export", target, line, original))
                    else:
                        bindings[symbol].add((target, original))
                elif module.startswith(".") or (kind != "import-py" and module.startswith("@/")):
                    edges[name].append(("diagnostic-import", module, line, symbol))
        local = defaultdict(set)
        for kind, symbol, line, _ in record["facts"]:
            if kind in ("function", "class"):
                local[symbol].add(line)
        for kind, symbol, line, detail in record["facts"]:
            if kind in ("call", "inherits", "component-use"):
                root, _, rest = symbol.partition(".")
                local_name, definition = local_definition(symbol, detail, local)
                if definition is not None:
                    edge(name, name, kind, line, f"{detail} => {local_name}:{definition} [INFERRED LOCAL]")
                elif len(bindings.get(root, ())) == 1:
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
    if kind == "diagnostic-import":
        return f"UNRESOLVED IMPORT {target} | {path}:{line} | {label} [INDEX HINT]"
    if kind == "diagnostic-export":
        return f"EXPORT NOT INDEXED {label} | {path}:{line} => {target} [VERIFY SOURCE]"
    return f"EDGE {kind} | {path}:{line} => {target} | {label}"


def summary(head, files, edges, reverse, found):
    counts = Counter(f["parser"] for f in files.values())
    lines = [f"CodeMap 2.0 | HEAD {head[:12]} | {len(files)} files | {sum(map(len, edges.values()))} static edges", "Search first: python3 scripts/codemap.py --query 'task or symbol' (or --trace, --impact, --tests, --security, --related, --path A B). Never read the complete map; verify source before edits.", "Coverage: " + ", ".join(f"{k}={v}" for k, v in sorted(counts.items())), "Relationships: imports resolved by path; calls and SQL hints are inferred, not runtime proof. Dynamic dispatch and unsupported languages may be incomplete."]
    roots = Counter(p.split("/")[0] for p in files if "/" in p)
    lines.append("Areas: " + ", ".join(f"{k} ({v})" for k, v in roots.most_common(12)))
    routes = [fact_line(p, f) for p, r in files.items() for f in r["facts"] if f[0] == "route"]
    lines += [f"Routes ({len(routes)} detected):", *routes[:12], f"Dependency cycle witnesses: {len(found)}; use --cycles.", "Most referenced files:", *[f"{p} ({len(reverse[p])} incoming files)" for p in sorted(reverse, key=lambda p: (-len(reverse[p]), p))[:8]]]
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


STOP_WORDS = frozenset("py ts tsx js jsx sql md json the a an in of for to how do does i me find where what is why my and with when work which".split())
DECLARATIONS = {"function", "class", "table", "db-function", "route"}
TOKEN = re.compile(r"[a-z0-9]+")
CAMEL = re.compile(r"([a-z0-9])([A-Z])")
# General code vocabulary bridges. These add weak evidence; source terms win ties.
VOCABULARY = {"login": ("auth", "authentication", "signin"),
              "authorization": ("auth", "permission"),
              "interface": ("ui",), "preferences": ("settings",)}


@lru_cache(maxsize=2048)
def words(s):
    return frozenset(TOKEN.findall(CAMEL.sub(r"\1 \2", s).lower())) - STOP_WORDS


@lru_cache(maxsize=4096)
def stem(term):
    if term.endswith("ify") and len(term) > 4:
        return term[:-1]
    if term.endswith("ified") and len(term) > 6:
        return term[:-3]
    for suffix in ("ication", "ing", "ed", "es", "s"):
        if term.endswith(suffix) and len(term) - len(suffix) >= 3:
            return term[:-len(suffix)]
    return term


def match_score(query, label):
    q, s = query.casefold(), label.casefold()
    return (100 if q == s else 35 if q in s else 0) + 5 * len(words(query) & words(label))


def ranked(query, files):
    terms = sorted(words(query))
    q = query.casefold()
    prefer_source = not ({"test", "tests", "spec"} & set(terms))
    # Index only vocabulary frequency, rather than building postings for every
    # fact and copying file-path tokens into every row.
    frequency = Counter()
    for path, record in files.items():
        vocabulary = set(words(path))
        for fact in record["facts"]:
            vocabulary.update(words(fact[1]))
        frequency.update(vocabulary)
    stems = defaultdict(list)
    for term in frequency:
        stems[stem(term)].append(term)
    evidence = defaultdict(list)
    for index, term in enumerate(terms):
        expansions = {term: 1.0}
        for variant in stems[stem(term)]:
            expansions.setdefault(variant, 0.8)
        for variant in VOCABULARY.get(term, ()):
            expansions.setdefault(variant, 0.72)
        if not any(variant in frequency for variant in expansions) and len(term) >= 4:
            for variant in get_close_matches(term, sorted(frequency), n=2, cutoff=0.8):
                expansions.setdefault(variant, 0.55)
        for variant, weight in expansions.items():
            if variant in frequency:
                evidence[variant].append((index, weight * (1 + 1 / frequency[variant] ** 0.25)))

    def collect(tokens, weight, scores):
        for token in sorted(tokens & evidence.keys()):
            for index, value in evidence[token]:
                scores[index] = max(scores.get(index, 0), value * weight)

    def candidates():
        for path, record in files.items():
            context = {}
            collect(words(path), 0.95, context)
            path_lower = path.casefold()
            test_penalty = 0.8 if prefer_source and TEST.search(path) else 0
            best = {}
            for fact in (None, *record["facts"]):
                label = fact[1] if fact else path
                lower = label.casefold()
                exact = 90 if q == lower else 8 if q in lower else 0
                scores = context.copy()
                if fact:
                    collect(words(label), 1.1, scores)
                if not scores and not exact:
                    continue
                kind = fact[0] if fact else "file"
                # Reward multiple distinct query concepts, even when a symbol
                # and its enclosing path provide different pieces of context.
                score = exact + sum(scores.values()) + 1.2 * len(scores) - test_penalty
                if scores:
                    score += 0.4 if kind in DECLARATIONS else 0
                # Querying a path should return that file before its symbols.
                if fact is not None and q == path_lower:
                    score -= 1
                key = (label, fact[2] if fact else 0)
                if key not in best or score > best[key][0]:
                    best[key] = (score, path, fact)
            yield from best.values()

    hits = nlargest(256, candidates(), key=lambda hit: hit[0])
    return [(score, path, fact_line(path, fact) if fact else f"FILE {path}")
            for score, path, fact in hits]


def walk(start, links, depth=3):
    seen, queue = set(start), deque((p, 0) for p in start)
    while queue:
        p, d = queue.popleft()
        if d == depth:
            continue
        for target in sorted(links.get(p, ())):
            if target not in seen:
                seen.add(target); queue.append((target, d + 1)); yield target


def query_result(mode, query, files, edges, forward, reverse, destination=None, budget=650):
    hits = ranked(query, files)
    if not hits:
        return ["No indexed matches; use targeted source search. This does not establish absence."]
    if mode == "tests":
        direct = next((path for _, path, _ in hits if not TEST.search(path)), None)
    else:
        direct = None
    top = list(dict.fromkeys(p for score, p, _ in hits if score == hits[0][0]))[:12]
    if direct and direct not in top:
        top.append(direct)
    out = [f"CodeMap {mode}: {query} | verify source"]
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
    limit = min(12 if mode in ("tests", "impact", "security") else 24, max(2, budget // 65))
    if mode == "query" and len(words(query)) > 1:
        per_file = Counter()
        for _, path, line in hits:
            if per_file[path] < 2:
                out.append(line)
                per_file[path] += 1
                if len(out) > limit:
                    break
    else:
        out += [line for _, _, line in hits[:limit]]
    if mode in ("trace", "query", "related", "security"):
        for p in top:
            out.extend(edge_line(p, e) for e in edges.get(p, ()) if mode != "security" or is_security(e[1]) or e[0] in ("rpc", "policy", "rls", "table-use"))
            for src in sorted(reverse.get(p, ())):
                out.extend(edge_line(src, e) for e in edges[src] if e[1] == p and (mode != "security" or is_security(src)))
    if mode in ("impact", "tests", "related", "security"):
        affected = list(walk(top, reverse))
        if mode == "tests":
            # Look for tests of a feature's immediate implementation as well as
            # tests that depend directly on its UI entry point.
            neighbors = sorted({target for p in top for target in forward.get(p, ())
                                if match_score(query, target)})
            affected += [p for p in walk(neighbors[:12], reverse, 2) if TEST.search(p)]
        if mode in ("related", "security"):
            affected += list(walk(top, forward, 2))
        out += [f"{mode.upper()} {p} [STATIC CANDIDATE]" for p in dict.fromkeys(top + affected) if (mode != "tests" or TEST.search(p)) and (mode != "security" or is_security(p))]
    if mode in ("trace", "query", "related", "security"):
        # Exact symbol edges before unrelated edges from a large file.
        start = next((i for i, line in enumerate(out) if line.startswith("EDGE ")), len(out))
        ranked_edges = sorted(set(out[start:]), key=lambda line: (
            0 if line.startswith(mode.upper() + " ") else 1, -match_score(query, line), line
        ))
        out[start:] = ranked_edges[:max(2, budget // 150)] if mode == "query" else ranked_edges
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


def verified_render(fp, edges, forward, reverse, found, head, files, check):
    receipt = git_path("codemap-render.receipt")
    if receipt.is_symlink():
        raise ValueError("Refusing symlink render receipt")
    old = ""
    old_complete = True
    if OUT.exists():
        saved_fp = None
        if not check:
            try:
                saved_fp, saved_digest = receipt.read_text(encoding="ascii").split()
                if saved_fp == fp:
                    with OUT.open("rb") as stream:
                        if hashlib.file_digest(stream, "sha256").hexdigest() == saved_digest:
                            return True
            except (OSError, ValueError):
                pass
        try:
            with OUT.open(encoding="utf-8") as stream:
                if saved_fp and saved_fp != fp:
                    # A changed input fingerprint needs the handwritten overview,
                    # while the generated detail is replaced from current facts.
                    header = []
                    for line in stream:
                        header.append(line)
                        if END in line or line.startswith("## Detailed index"):
                            old_complete = False
                            break
                    old = "".join(header)
                else:
                    old = stream.read()
        except UnicodeDecodeError:
            old = ""
    output = render(head, fp, files, old, edges, forward, reverse, found)
    if check:
        return old == output
    if not old_complete or old != output:
        atomic(OUT, output)
    atomic(receipt, fp + "\n" + hashlib.sha256(output.encode()).hexdigest() + "\n")
    return True


def remote_status(head, verbose=False):
    try:
        branch = git("symbolic-ref", "--short", "HEAD").decode().strip()
        remote = git("config", "--get", f"branch.{branch}.remote").decode().strip()
        ref = git("config", "--get", f"branch.{branch}.merge").decode().strip()
        if remote not in git("remote").decode().splitlines() or not ref.startswith("refs/heads/"):
            raise ValueError("No configured remote branch")
        # Keep startup responsive while giving an explicit upstream check time
        # to complete on slower Git transports.
        matches = git("ls-remote", "--exit-code", "--", remote, ref, timeout=20 if verbose else 5).decode().splitlines()
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
    group.add_argument("--cycles", action="store_true", help="List static dependency cycle witnesses")
    group.add_argument("--unused", action="store_true", help="Find unreferenced module-private TypeScript functions")
    group.add_argument("--duplicates", action="store_true", help="Find byte-identical parsed source files")
    group.add_argument("--diagnostics", action="store_true", help="List unresolved local module/export hints")
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
            if not verified_render(fp, edges, forward, reverse, found, head, files, args.check):
                print("CodeMap missing or stale; run python3 scripts/codemap.py.", file=sys.stderr)
                return 1
            if args.check:
                print(f"CodeMap current: {head[:12]}, {len(files)} indexed files.")
            if args.summary:
                print(bounded(summary(head, files, edges, reverse, found).splitlines(), args.budget))
            if args.stats:
                print(json.dumps(stats, sort_keys=True))
            if args.cycles:
                print(bounded([f"{len(found)} static cycle witnesses", *("CYCLE " + " => ".join(c) for c in found)], args.budget))
            if args.unused:
                candidates = [fact_line(p, f) for p, r in files.items()
                              for f in r["facts"] if f[0] == "unused-candidate"]
                print(bounded([f"{len(candidates)} unused candidates", *candidates], args.budget))
            if args.duplicates:
                copies = defaultdict(list)
                for p, record in files.items():
                    if record["facts"]:
                        copies[record["hash"]].append(p)
                lines = ["DUPLICATE SOURCE " + " = ".join(paths) for paths in copies.values() if len(paths) > 1]
                print(bounded([f"{len(lines)} exact source duplicate groups", *lines], args.budget))
            if args.diagnostics:
                parse_issues = [fact_line(p, fact) for p, record in files.items()
                                for fact in record["facts"] if fact[0] == "parse-error"]
                issues = [edge_line(p, e) for p, entries in edges.items() for e in entries if e[0].startswith("diagnostic-")]
                heading = (f"{len(issues)} indexed import diagnostics (hints, not compiler errors)"
                           if issues else "No indexed import diagnostics; not a type check.")
                print(bounded([heading, *parse_issues, *issues], args.budget))
            for mode in ("query", "search", "trace", "impact", "tests", "security", "related", "explain", "path"):
                value = getattr(args, mode)
                if value:
                    q, dest = value if mode == "path" else (value, None)
                    print(bounded(query_result("query" if mode in ("search", "explain") else mode, q, files, edges, forward, reverse, dest, args.budget), args.budget))
        upstream = remote_status(head, args.check) if args.remote else True
        return 0 if upstream or not args.check else 1
    except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError) as exc:
        print(f"codemap: {type(exc).__name__}: refresh failed", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
