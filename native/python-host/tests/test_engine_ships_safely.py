"""Things the control engine must never do in a signed, distributed build.

Each rule here was true of the engine when it arrived, was removed, and is
invisible the moment it comes back — a merge, a revert, or a well-meaning
"just make it work" fix restores any of them in one line. They are cheap to
assert and expensive to discover on a customer's machine.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

ENGINE = Path(__file__).resolve().parents[2] / "ocade_control_engine"

pytestmark = pytest.mark.skipif(not ENGINE.is_dir(), reason="control engine is not installed")


def _python_sources() -> list[Path]:
    return [
        path
        for path in ENGINE.rglob("*.py")
        if "__pycache__" not in path.parts and ".venv" not in path.parts
    ]


def _calls_in(tree: ast.AST):
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            yield node


def _callee_name(node: ast.Call) -> str:
    func = node.func
    if isinstance(func, ast.Name):
        return func.id
    if isinstance(func, ast.Attribute):
        return func.attr
    return ""


class TestTheEngineNeverInstallsSoftware:
    """`core/tts.py` used to `pip install kokoro>=0.9` mid-sentence.

    A shipped binary that rewrites its own dependencies at runtime is read by
    antivirus and code-signing review as exactly what it resembles, and it
    means a spoken reply can change what is installed on a paying customer's
    computer. The dependency set is resolved once, at install time.
    """

    def test_no_source_file_shells_out_to_pip_install(self) -> None:
        offenders: list[str] = []
        for path in _python_sources():
            tree = ast.parse(path.read_text(encoding="utf-8", errors="replace"), str(path))
            for call in _calls_in(tree):
                if _callee_name(call) not in {"run", "Popen", "call", "check_call", "check_output"}:
                    continue
                # The command is the first positional argument: a list of parts.
                if not call.args or not isinstance(call.args[0], ast.List):
                    continue
                parts = [
                    element.value
                    for element in call.args[0].elts
                    if isinstance(element, ast.Constant) and isinstance(element.value, str)
                ]
                if "pip" in parts and "install" in parts:
                    offenders.append(f"{path.relative_to(ENGINE)}:{call.lineno}")

        assert not offenders, (
            "These call pip install at runtime, which disqualifies a signed build: "
            + ", ".join(offenders)
        )

    def test_the_auto_installer_module_is_gone(self) -> None:
        # It had no callers and installed 20+ packages plus a Chromium download.
        assert not (ENGINE / "core" / "installer.py").exists()


class TestTheEngineNeverRunsGeneratedCode:
    """`actions/desktop.py` used to exec() Python written by a remote model.

    It was guarded by a hand-built dict of "safe" builtins, which is not a
    security boundary: the same dict handed out pyautogui, ctypes and winreg,
    and anything holding a real object can walk back out to the real builtins.
    """

    @pytest.mark.parametrize("builtin", ["exec", "eval", "compile"])
    def test_no_source_file_evaluates_code_at_runtime(self, builtin: str) -> None:
        offenders: list[str] = []
        for path in _python_sources():
            tree = ast.parse(path.read_text(encoding="utf-8", errors="replace"), str(path))
            for call in _calls_in(tree):
                if isinstance(call.func, ast.Name) and call.func.id == builtin:
                    offenders.append(f"{path.relative_to(ENGINE)}:{call.lineno}")

        assert not offenders, f"{builtin}() at runtime: " + ", ".join(offenders)

    def test_the_project_building_agent_is_gone(self) -> None:
        # dev_agent planned, wrote, pip-installed and ran whole projects from a
        # model's output. Unreachable from OCADE, and not something to keep.
        assert not (ENGINE / "actions" / "dev_agent.py").exists()


class TestNoPrivateKeyIsShipped:
    """`config/certs/jarvis.key` was a real private key inside the engine tree.

    A key every installation shares is not a secret, and the dashboard that
    used it binds 0.0.0.0. Both the key and the silent HTTP downgrade are gone.
    """

    def test_no_key_material_anywhere_in_the_engine(self) -> None:
        found = [
            str(path.relative_to(ENGINE))
            for path in ENGINE.rglob("*")
            if path.is_file() and path.suffix.lower() in {".key", ".pem", ".p12", ".pfx"}
        ]
        assert not found, "key material in a shipped tree: " + ", ".join(found)

    def test_private_key_headers_appear_in_no_file(self) -> None:
        for path in _python_sources():
            assert "BEGIN PRIVATE KEY" not in path.read_text(encoding="utf-8", errors="replace")
            assert "BEGIN RSA PRIVATE KEY" not in path.read_text(encoding="utf-8", errors="replace")
