"""Hash checkout inputs and published products before skipping Graphify's scan."""
import hashlib
import os
from pathlib import Path
import subprocess

digest = hashlib.sha256()
paths = subprocess.check_output(["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"])
for name in sorted(set(paths.split(b"\0")) - {b""}):
    path = Path(os.fsdecode(name))
    digest.update(name + b"\0")
    if path.is_symlink():
        digest.update(b"link:" + os.fsencode(os.readlink(path)))
    elif path.is_file():
        with path.open("rb") as stream:
            digest.update(hashlib.file_digest(stream, "sha256").digest())
    else:
        digest.update(b"absent")
print(digest.hexdigest())
