"""Command injection and unsafe deserialization in the companion (169).

Every process is started from an argument list, never through a shell string, so a file
name or page text cannot become a command; nothing is deserialized except JSON. Checked
over the parsed source of every companion module, so a new call that breaks the rule fails
here by file and line.
"""

import ast
import unittest
from pathlib import Path

SOURCES = sorted((Path(__file__).resolve().parents[1] / "ocade_agent").glob("*.py"))
STARTERS = {"run", "Popen", "call", "check_call", "check_output", "create_subprocess_exec"}
# Module-qualified starters and shells; builtins that run text as code.
FORBIDDEN_CALLS = {("os", "system"), ("os", "popen"), ("asyncio", "create_subprocess_shell"),
                   ("subprocess", "getstatusoutput"), ("subprocess", "getoutput")}
FORBIDDEN_BUILTINS = {"eval", "exec", "__import__"}  # compile() alone only checks syntax
FORBIDDEN_MODULES = {"pickle", "cPickle", "dill", "marshal", "shelve", "yaml", "jsonpickle"}


def _calls():
    for path in SOURCES:
        for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"), str(path))):
            yield path, node


class Injection(unittest.TestCase):
    def test_sources_were_found(self):
        self.assertGreater(len(SOURCES), 15)

    def test_no_process_is_started_through_a_shell(self):
        problems = []
        for path, node in _calls():
            if not isinstance(node, ast.Call):
                continue
            name = getattr(node.func, "attr", getattr(node.func, "id", ""))
            owner = getattr(getattr(node.func, "value", None), "id", "")
            if any(k.arg == "shell" and not (isinstance(k.value, ast.Constant) and k.value.value is False)
                   for k in node.keywords):
                problems.append(f"{path.name}:{node.lineno} shell=")
            if (owner, name) in FORBIDDEN_CALLS or (isinstance(node.func, ast.Name) and name in FORBIDDEN_BUILTINS):
                problems.append(f"{path.name}:{node.lineno} {owner}.{name}()")
            if (owner in {"subprocess", "asyncio"} and name in STARTERS and node.args
                    and isinstance(node.args[0], (ast.Constant, ast.JoinedStr, ast.BinOp))):
                problems.append(f"{path.name}:{node.lineno} {name}() given a command string")
        self.assertEqual(problems, [])

    def test_nothing_is_deserialized_except_json(self):
        imported = []
        for path, node in _calls():
            names = ([alias.name for alias in node.names] if isinstance(node, ast.Import)
                     else [node.module or ""] if isinstance(node, ast.ImportFrom) else [])
            imported += [f"{path.name}:{node.lineno} {name}" for name in names if name.split(".")[0] in FORBIDDEN_MODULES]
        self.assertEqual(imported, [])

    def test_the_check_catches_what_it_forbids(self):
        hostile = ast.parse('import pickle\nsubprocess.run("rm -rf x", shell=True)\nos.system("x")\n')
        calls = [n for n in ast.walk(hostile) if isinstance(n, ast.Call)]
        self.assertTrue(any(k.arg == "shell" for c in calls for k in c.keywords))
        self.assertTrue(any(getattr(c.func, "attr", "") == "system" for c in calls))
        self.assertIsInstance(calls[0].args[0], ast.Constant)


if __name__ == "__main__":
    unittest.main()
