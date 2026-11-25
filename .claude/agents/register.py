#!/usr/bin/env python3
"""Generate local Claude agent definitions from the single tracked Markdown source."""
from pathlib import Path
import re
import tempfile
import os

AGENTS = Path(__file__).resolve().parent
SOURCE = AGENTS.parent.parent / "claude-subagents.md"
ROLES = ("scout", "checker", "verifier")


def main():
    text = SOURCE.read_text(encoding="utf-8")
    blocks = re.findall(
        r"^## (scout|checker|verifier)\n\n" + r"\x60{3}text\n(.*?)^\x60{3}$",
        text,
        re.MULTILINE | re.DOTALL,
    )
    definitions = dict(blocks)
    if len(blocks) != len(ROLES) or set(definitions) != set(ROLES):
        raise ValueError("Expected exactly one definition for each role")
    for role in ROLES:
        definition = definitions[role]
        if not definition.startswith("---\n") or f"\nname: {role}\n" not in definition.split("\n---\n", 1)[0]:
            raise ValueError(f"Invalid frontmatter for {role}")
        if "\n---\n\n" not in definition:
            raise ValueError(f"Missing prompt for {role}")
        if (AGENTS / f"{role}.md").is_symlink():
            raise ValueError(f"Refusing symlink for {role}")
    for role in ROLES:
        target = AGENTS / f"{role}.md"
        data = definitions[role]
        if target.exists() and target.read_text(encoding="utf-8") == data:
            continue
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", newline="\n", dir=AGENTS, delete=False
        ) as tmp:
            tmp.write(data)
            temp = Path(tmp.name)
        try:
            os.replace(temp, target)
        finally:
            temp.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
