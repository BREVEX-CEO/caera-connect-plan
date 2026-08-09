from __future__ import annotations

from pathlib import Path

from ocade_native.application_discovery import application_id, executable_from_display_icon


def test_application_identity_is_path_bound_and_stable(tmp_path: Path) -> None:
    executable = tmp_path / "Unknown Tool.exe"
    executable.write_bytes(b"MZ fixture")
    first = application_id(str(executable))
    assert first == application_id(str(executable.resolve()))
    assert first.startswith("winapp:")
    assert len(first) == len("winapp:") + 64


def test_display_icon_parser_never_infers_a_missing_executable(tmp_path: Path) -> None:
    executable = tmp_path / "Tool.exe"
    executable.write_bytes(b"MZ fixture")
    assert executable_from_display_icon(f'"{executable}",0') == str(executable.resolve())
    assert executable_from_display_icon(str(tmp_path / "missing.exe")) is None
