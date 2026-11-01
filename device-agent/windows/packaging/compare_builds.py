"""Two builds of the frozen companion from the same pinned inputs must be identical (plan.md 185).

    python packaging/compare_builds.py <first dist folder> <second dist folder>

Prints every file that differs or exists in only one build; exits 1 if any does.
"""

import hashlib
import sys
from pathlib import Path


def digests(root: Path) -> dict[str, str]:
    return {p.relative_to(root).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted(root.rglob("*")) if p.is_file()}


first, second = (digests(Path(arg)) for arg in sys.argv[1:3])
differ = sorted(name for name in first.keys() | second.keys() if first.get(name) != second.get(name))
for name in differ:
    print(f"DIFFERS: {name}")
print(f"{len(first)} files, {len(differ)} differ")
sys.exit(1 if differ else 0)
