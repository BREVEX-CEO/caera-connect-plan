"""Reading code the way a compiler does, so the model can review it like a person.

THE DIVISION OF LABOUR, WHICH IS THE WHOLE DESIGN
--------------------------------------------------
A language model is good at "this function is doing three jobs" and bad at "line
147 has a syntax error". It is good at explaining and generating, and it is
unreliable at counting, at resolving scope, and at noticing the fourth of four
identical-looking blocks.

So the split is:

  THIS MODULE  — parses. Syntax errors with real line numbers, the actual list
                 of functions and classes, imports that are never used, bare
                 excepts, mutable default arguments, `eval`, hard-coded secrets.
                 Every finding carries a line number taken from a parse tree,
                 not from a guess.

  THE MODEL    — reads those findings plus the source, and says what they mean
                 and what to do. It also writes new code, which is a thing no
                 amount of parsing can do.

A REVIEW THAT INVENTS A LINE NUMBER IS WORSE THAN NO REVIEW, because the reader
goes to that line, finds nothing, and stops trusting the whole report. Every
`line` in the output below came out of `ast` or out of `enumerate`.

WHY PYTHON GETS A REAL PARSER AND THE OTHERS GET HEURISTICS
------------------------------------------------------------
`ast` ships with the interpreter this engine already runs in, so Python analysis
is exact and free. For JavaScript, TypeScript and the rest there is no parser
available without adding a dependency, so those languages get a smaller,
honestly-labelled pass: bracket balance, obvious smells, and structure found by
pattern. The receipt says which depth was used — `parsed` or `scanned` — so a
caller never mistakes a shallow read for a deep one.

NOTHING HERE EXECUTES THE CODE IT IS GIVEN.
`ast.parse` builds a tree and runs nothing. There is no `exec`, no `eval`, no
import of the module under review, and no subprocess. Reviewing a file must
never be a way to run it.
"""

from __future__ import annotations

import ast
import re
from pathlib import Path
from typing import Any

_MAX_SOURCE = 200_000
_MAX_FINDINGS = 60

#: Extension to language. The key the caller passes is normalised through this
#: too, so "py", ".py" and "python" all mean the same thing.
_LANGUAGES = {
    ".py": "python",
    ".pyi": "python",
    ".js": "javascript",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".json": "json",
    ".sh": "shell",
    ".rs": "rust",
    ".go": "go",
    ".java": "java",
    ".c": "c",
    ".h": "c",
    ".cpp": "cpp",
    ".cs": "csharp",
    ".rb": "ruby",
    ".php": "php",
    ".sql": "sql",
    ".html": "html",
    ".css": "css",
    ".yml": "yaml",
    ".yaml": "yaml",
    ".md": "markdown",
}

#: Where credentials hide in source. Deliberately conservative: a false positive
#: costs one line of noise in a review, a false negative costs a leaked key that
#: the review said was fine.
_SECRET_PATTERNS = (
    (re.compile(r"""(?i)\b(api[_-]?key|secret|passwd|password|token|bearer)\b\s*[:=]\s*["'][^"']{8,}["']"""), "a credential is written into the source"),
    (re.compile(r"\bsk-[A-Za-z0-9]{20,}\b"), "what looks like an OpenAI-style key"),
    (re.compile(r"\bAKIA[0-9A-Z]{16}\b"), "what looks like an AWS access key id"),
    (re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}\b"), "what looks like a GitHub token"),
    (re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----"), "a private key"),
)

#: Line-level smells: (pattern, severity, message, applies-to).
#:
#: THE FOURTH FIELD IS LOAD-BEARING AND USED TO BE A `startswith` TEST ON THE
#: MESSAGE. That worked until somebody reworded a message, and it silently
#: stopped excluding the rule it was written for. "curly" means the C-family
#: languages; "any" means every language; and a Python file never sees a rule
#: about `var` or `@ts-ignore` firing on a string that happens to contain one.
#:
#: `eval` is deliberately "curly" ONLY. Python's `eval` is caught by the AST
#: walk with an exact call site, and having both fire reported the same line
#: twice under two different wordings.
_ANY = "any"
_CURLY = "curly"
_CURLY_LANGUAGES = frozenset(
    {"javascript", "typescript", "java", "c", "cpp", "csharp", "go", "rust", "php"}
)

_LINE_SMELLS = (
    (re.compile(r"\b(TODO|FIXME|HACK|XXX)\b"), "note", "an unfinished note is left in the code", _ANY),
    (re.compile(r"\bconsole\.log\s*\("), "note", "a debug print left in", _CURLY),
    (re.compile(r"\bdebugger\b\s*;"), "warning", "a `debugger` statement will halt the browser", _CURLY),
    (re.compile(r"\b(eval|new\s+Function)\s*\("), "warning", "`eval` runs arbitrary code", _CURLY),
    (re.compile(r"==\s*(?:null|undefined)\b"), "note", "loose equality against null/undefined", _CURLY),
    (re.compile(r"\bvar\s+\w+"), "note", "`var` — `let` or `const` is scoped properly", _CURLY),
    (re.compile(r":\s*any\b"), "note", "`any` switches off the type checker here", _CURLY),
    (re.compile(r"@ts-ignore"), "warning", "`@ts-ignore` hides a real type error", _CURLY),
    (re.compile(r"\binnerHTML\s*="), "warning", "assigning innerHTML can inject markup", _CURLY),
    (re.compile(r"\bdangerouslySetInnerHTML\b"), "warning", "raw HTML is being injected", _CURLY),
)

#: A function longer than this is doing more than one thing often enough to be
#: worth saying so. Not an error — some genuinely are one long thing.
_LONG_FUNCTION_LINES = 60
_LONG_LINE_CHARS = 120


class CodeRefused(RuntimeError):
    """The code will not be analysed, with a reason."""


#: Shapes that only appear in Python. Used to sniff a language when the caller
#: pasted code with no file name — which is the normal case in a chat box.
_PYTHONISH = re.compile(
    r"^\s*(?:def|class)\s+\w+|^\s*(?:from\s+[\w.]+\s+)?import\s+\w|^\s*(?:if|for|while|with|try)\b.*:\s*$",
    re.MULTILINE,
)

#: Shapes that rule Python out. `ast.parse` accepts a surprising amount of
#: JavaScript — `x = 1` parses in both — so a positive Python sniff is only
#: trusted when none of these is present.
_NOT_PYTHON = re.compile(r"[{;]\s*$|=>|\bfunction\b|\bconst\b|\blet\b|\bvar\b|</\w+>", re.MULTILINE)


def _language_for(name: str, explicit: str = "", source: str = "") -> str:
    said = " ".join((explicit or "").split()).lower().lstrip(".")
    if said:
        if said in _LANGUAGES.values():
            return said
        mapped = _LANGUAGES.get(f".{said}")
        if mapped:
            return mapped

    suffix = Path(name or "").suffix.lower()
    known = _LANGUAGES.get(suffix)
    if known:
        return known

    # NO NAME AND NO LANGUAGE — which is exactly what pasted code looks like.
    # Falling straight to "text" sent every pasted Python function down the
    # shallow scan: no functions found, no bare-except check, no mutable
    # default check, and a receipt that said "0 function(s)" about a file full
    # of them. A sniff costs one regex and one parse attempt.
    if source and _PYTHONISH.search(source) and not _NOT_PYTHON.search(source):
        try:
            ast.parse(source)
        except SyntaxError:
            # It looks like Python and does not parse. That is still Python —
            # and saying so is what surfaces the syntax error, which is the
            # single most useful thing a review of broken code can report.
            return "python"
        return "python"
    return "text"


def _finding(line: int, severity: str, message: str, snippet: str = "") -> dict[str, Any]:
    return {
        "line": max(0, int(line)),
        "severity": severity,
        "message": message,
        "snippet": " ".join((snippet or "").split())[:160],
    }


# ----------------------------------------------------------------- python --


class _PythonWalk(ast.NodeVisitor):
    """One pass over the tree, collecting structure and findings together.

    ONE PASS RATHER THAN SIX. An earlier draft walked the tree separately for
    functions, for imports, for excepts and so on. Each walk was clear on its
    own and together they were four times the cost on a large file — and, worse,
    they disagreed about nesting, so a method inside a class was counted as a
    function by one walk and skipped by another.
    """

    def __init__(self, source_lines: list[str]) -> None:
        self.lines = source_lines
        self.functions: list[dict[str, Any]] = []
        self.classes: list[dict[str, Any]] = []
        self.imports: list[dict[str, Any]] = []
        self.findings: list[dict[str, Any]] = []
        #: Every name the file MENTIONS, for the unused-import check. Collected
        #: as raw identifiers rather than resolved scopes: an import used only
        #: inside a nested function still counts, which is the answer a reviewer
        #: wants.
        self.used: set[str] = set()

    # -- structure --

    def _function(self, node: ast.FunctionDef | ast.AsyncFunctionDef) -> None:
        end = getattr(node, "end_lineno", node.lineno) or node.lineno
        length = end - node.lineno + 1
        self.functions.append(
            {
                "name": node.name,
                "line": node.lineno,
                "lines": length,
                "arguments": [arg.arg for arg in node.args.args],
                "isAsync": isinstance(node, ast.AsyncFunctionDef),
                "hasDocstring": ast.get_docstring(node) is not None,
            }
        )
        if length > _LONG_FUNCTION_LINES:
            self.findings.append(
                _finding(
                    node.lineno,
                    "note",
                    f"`{node.name}` is {length} lines — long enough to be doing more than one job",
                )
            )

        # MUTABLE DEFAULT ARGUMENTS. The classic Python bug that survives review
        # by looking completely ordinary: the list is created once, at
        # definition, and every call that relies on the default shares it.
        for default in list(node.args.defaults) + [d for d in node.args.kw_defaults if d]:
            if isinstance(default, (ast.List, ast.Dict, ast.Set)):
                self.findings.append(
                    _finding(
                        default.lineno,
                        "warning",
                        f"`{node.name}` has a mutable default argument — it is shared between calls",
                    )
                )
        self.generic_visit(node)

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:  # noqa: N802
        self._function(node)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:  # noqa: N802
        self._function(node)

    def visit_ClassDef(self, node: ast.ClassDef) -> None:  # noqa: N802
        self.classes.append(
            {
                "name": node.name,
                "line": node.lineno,
                "methods": sum(
                    1
                    for child in node.body
                    if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef))
                ),
                "hasDocstring": ast.get_docstring(node) is not None,
            }
        )
        self.generic_visit(node)

    def visit_Import(self, node: ast.Import) -> None:  # noqa: N802
        for alias in node.names:
            self.imports.append(
                {"name": alias.asname or alias.name.split(".")[0], "module": alias.name, "line": node.lineno}
            )
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:  # noqa: N802
        for alias in node.names:
            self.imports.append(
                {
                    "name": alias.asname or alias.name,
                    "module": node.module or "",
                    "line": node.lineno,
                }
            )
        self.generic_visit(node)

    # -- findings --

    def visit_Name(self, node: ast.Name) -> None:  # noqa: N802
        self.used.add(node.id)
        self.generic_visit(node)

    def visit_Attribute(self, node: ast.Attribute) -> None:  # noqa: N802
        # `json.dumps` uses `json`; recording only the Name would miss it when
        # the attribute chain is what keeps the import alive.
        base = node
        while isinstance(base, ast.Attribute):
            base = base.value  # type: ignore[assignment]
        if isinstance(base, ast.Name):
            self.used.add(base.id)
        self.generic_visit(node)

    def visit_ExceptHandler(self, node: ast.ExceptHandler) -> None:  # noqa: N802
        if node.type is None:
            self.findings.append(
                _finding(
                    node.lineno,
                    "warning",
                    "a bare `except:` swallows KeyboardInterrupt and SystemExit too",
                )
            )
        # `except: pass` is the shape that hides the failure entirely, so it is
        # called out separately from a bare except that at least does something.
        if len(node.body) == 1 and isinstance(node.body[0], ast.Pass):
            self.findings.append(
                _finding(node.lineno, "warning", "this handler catches an error and does nothing with it")
            )
        self.generic_visit(node)

    def visit_Call(self, node: ast.Call) -> None:  # noqa: N802
        target = node.func
        name = ""
        if isinstance(target, ast.Name):
            name = target.id
        elif isinstance(target, ast.Attribute):
            name = target.attr

        if name in ("eval", "exec"):
            self.findings.append(
                _finding(node.lineno, "warning", f"`{name}` runs code built at runtime")
            )
        # `shell=True` is the difference between running a program and running
        # a shell string somebody else may control.
        for keyword in node.keywords:
            if keyword.arg == "shell" and isinstance(keyword.value, ast.Constant) and keyword.value.value is True:
                self.findings.append(
                    _finding(node.lineno, "warning", "`shell=True` passes the command through a shell")
                )
        self.generic_visit(node)

    def visit_Compare(self, node: ast.Compare) -> None:  # noqa: N802
        # `x == None` works but is not the check anybody means; `is None` is.
        for op, comparator in zip(node.ops, node.comparators):
            if isinstance(op, (ast.Eq, ast.NotEq)) and isinstance(comparator, ast.Constant):
                if comparator.value is None:
                    self.findings.append(
                        _finding(node.lineno, "note", "comparing to None with `==` — `is None` is the check")
                    )
        self.generic_visit(node)


def _analyse_python(source: str) -> dict[str, Any]:
    lines = source.splitlines()
    try:
        tree = ast.parse(source)
    except SyntaxError as error:
        # THE ONE FINDING THAT ENDS THE REVIEW. Everything below needs a tree,
        # and reporting style notes on a file that does not parse buries the
        # single thing the reader has to fix first.
        return {
            "depth": "parsed",
            "parses": False,
            "findings": [
                _finding(
                    error.lineno or 0,
                    "error",
                    f"the file does not parse: {error.msg}",
                    (error.text or ""),
                )
            ],
            "functions": [],
            "classes": [],
            "imports": [],
        }

    walk = _PythonWalk(lines)
    walk.visit(tree)

    # Unused imports, resolved against every identifier the file mentions.
    # `__all__` and star-imports both make this unanswerable, so a file
    # containing either is skipped rather than reported on wrongly.
    star_import = any(
        isinstance(node, ast.ImportFrom) and any(alias.name == "*" for alias in node.names)
        for node in ast.walk(tree)
    )
    declares_all = any(
        isinstance(node, ast.Assign)
        and any(isinstance(t, ast.Name) and t.id == "__all__" for t in node.targets)
        for node in ast.walk(tree)
    )
    if not star_import and not declares_all:
        for entry in walk.imports:
            if entry["name"] == "*" or entry["name"] in walk.used:
                continue
            # A re-export in `__init__.py` looks exactly like an unused import,
            # so the message says "appears" rather than asserting.
            walk.findings.append(
                _finding(entry["line"], "note", f"`{entry['name']}` is imported but appears unused")
            )

    if not ast.get_docstring(tree):
        walk.findings.append(_finding(1, "note", "the module has no docstring saying what it is for"))

    return {
        "depth": "parsed",
        "parses": True,
        "findings": walk.findings,
        "functions": walk.functions,
        "classes": walk.classes,
        "imports": walk.imports,
    }


# ------------------------------------------------------------ other langs --

_JS_FUNCTION = re.compile(
    r"^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)"
    r"|^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\("
)
_JS_CLASS = re.compile(r"^\s*(?:export\s+)?(?:default\s+)?class\s+([A-Za-z_$][\w$]*)")
_JS_IMPORT = re.compile(r"""^\s*import\s.*?from\s+["']([^"']+)["']|^\s*(?:const|let|var)\s.*?=\s*require\(["']([^"']+)["']\)""")


def _analyse_generic(source: str, language: str) -> dict[str, Any]:
    """A scan, honestly labelled as one. No parser, so no claim of completeness."""
    lines = source.splitlines()
    findings: list[dict[str, Any]] = []
    functions: list[dict[str, Any]] = []
    classes: list[dict[str, Any]] = []
    imports: list[dict[str, Any]] = []

    for index, line in enumerate(lines, start=1):
        function = _JS_FUNCTION.match(line)
        if function:
            functions.append({"name": function.group(1) or function.group(2), "line": index, "lines": 0})
        klass = _JS_CLASS.match(line)
        if klass:
            classes.append({"name": klass.group(1), "line": index, "methods": 0})
        module = _JS_IMPORT.match(line)
        if module:
            imports.append({"name": module.group(1) or module.group(2), "module": module.group(1) or module.group(2), "line": index})

    # BRACKET BALANCE, WHICH IS THE ONLY SYNTAX CLAIM A SCAN CAN HONESTLY MAKE.
    # Strings and comments are stripped first, because a `}` inside a string
    # literal is not a closing brace and counting it produced a confident,
    # wrong "unbalanced braces" on perfectly good files.
    stripped = re.sub(r"//[^\n]*|/\*[\s\S]*?\*/", "", source)
    stripped = re.sub(r"""(["'`])(?:\\.|(?!\1)[^\\])*\1""", '""', stripped)
    for opener, closer, label in (("{", "}", "braces"), ("(", ")", "parentheses"), ("[", "]", "brackets")):
        difference = stripped.count(opener) - stripped.count(closer)
        if difference != 0:
            findings.append(
                _finding(
                    0,
                    "error",
                    f"{abs(difference)} unclosed {label}" if difference > 0 else f"{abs(difference)} extra closing {label}",
                )
            )

    return {
        "depth": "scanned",
        # A scan cannot decide this, and answering False would report every
        # unparsed language as broken.
        "parses": None,
        "findings": findings,
        "functions": functions,
        "classes": classes,
        "imports": imports,
        "language": language,
    }


# ------------------------------------------------------------------ public --


def review(code: str, *, name: str = "", language: str = "") -> dict[str, Any]:
    """Analyse a piece of source and return findings with real line numbers."""
    source = code if isinstance(code, str) else ""
    if not source.strip():
        raise CodeRefused("There is no code to review.")
    if len(source) > _MAX_SOURCE:
        raise CodeRefused(
            f"That is {len(source):,} characters. OCADE reviews up to {_MAX_SOURCE:,} at a time — "
            "point it at one file or one function."
        )

    resolved = _language_for(name, language, source)
    analysis = (
        _analyse_python(source) if resolved == "python" else _analyse_generic(source, resolved)
    )

    lines = source.splitlines()
    findings: list[dict[str, Any]] = list(analysis["findings"])

    # Language-agnostic line checks, run for every language INCLUDING Python:
    # a TODO and a hard-coded key are the same problem whatever the file is.
    curly = resolved in _CURLY_LANGUAGES
    for index, line in enumerate(lines, start=1):
        for pattern, severity, message, applies in _LINE_SMELLS:
            if applies == _CURLY and not curly:
                continue
            if pattern.search(line):
                findings.append(_finding(index, severity, message, line))
        for pattern, message in _SECRET_PATTERNS:
            if pattern.search(line):
                # THE SNIPPET IS DELIBERATELY OMITTED. Echoing the line back
                # would put the secret into the receipt, the transcript, and
                # whatever log the transcript lands in.
                findings.append(_finding(index, "error", f"{message} — move it to an environment variable"))
        if len(line) > _LONG_LINE_CHARS:
            findings.append(_finding(index, "note", f"line is {len(line)} characters long"))

    # Sorted by how much it matters, then by where it is, so a reader who fixes
    # from the top fixes the important things first.
    order = {"error": 0, "warning": 1, "note": 2}
    findings.sort(key=lambda row: (order.get(row["severity"], 3), row["line"]))
    trimmed = findings[:_MAX_FINDINGS]

    errors = sum(1 for row in findings if row["severity"] == "error")
    warnings = sum(1 for row in findings if row["severity"] == "warning")

    return {
        "name": name or "(pasted code)",
        "language": resolved,
        "depth": analysis["depth"],
        "parses": analysis["parses"],
        "lines": len(lines),
        "characters": len(source),
        "functions": analysis["functions"][:80],
        "classes": analysis["classes"][:40],
        "imports": analysis["imports"][:60],
        "findings": trimmed,
        "findingCount": len(findings),
        "truncated": len(findings) > len(trimmed),
        "errors": errors,
        "warnings": warnings,
        # Verified means THE ANALYSIS RAN — which for Python includes a real
        # parse. It is not a claim that the code is correct, and the detail
        # below is worded so nobody can read it as one.
        "verified": True,
        "detail": (
            f"{resolved} · {len(lines)} lines · "
            + (
                "does not parse — "
                if analysis["parses"] is False
                else ""
            )
            + f"{errors} error(s), {warnings} warning(s), {len(findings) - errors - warnings} note(s)"
            + (
                f"; {len(analysis['functions'])} function(s), {len(analysis['classes'])} class(es)."
                if analysis["parses"] is not False
                else "."
            )
        ),
    }


def review_file(folder: str, name: str) -> dict[str, Any]:
    """Review a source file from one of the user's approved folders."""
    from actions.knowledge import _resolve_under_root  # noqa: PLC0415

    try:
        path = _resolve_under_root(folder, name)
    except ValueError as error:
        raise CodeRefused(str(error)) from error
    if not path.is_file():
        raise CodeRefused(f"There is no file called {name} in {folder}.")
    try:
        source = path.read_text(encoding="utf-8", errors="replace")
    except OSError as error:
        raise CodeRefused(f"{name} could not be read ({type(error).__name__}).") from error

    result = review(source, name=path.name)
    result["path"] = str(path)
    result["source"] = source[:_MAX_SOURCE]
    return result
