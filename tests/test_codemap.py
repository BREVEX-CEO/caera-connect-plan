"""Regression tests for the local CodeMap refresh and freshness contract."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "codemap.py"


class CodeMapTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / "repo"
        self.root.mkdir()
        self.git("init", "-b", "work")
        self.git("config", "user.name", "CodeMap test")
        self.git("config", "user.email", "codemap@example.invalid")
        (self.root / "scripts").mkdir()
        shutil.copyfile(SCRIPT, self.root / "scripts" / "codemap.py")
        self.write(".gitignore", "CODEMAP.md\n.env\n")
        self.write("example.py", "def old():\n    return 1\n")
        self.git("add", ".")
        self.git("commit", "-qm", "fixture")
        self.map = self.root / "CODEMAP.md"

    def git(self, *args, cwd=None):
        return subprocess.run(["git", *args], cwd=cwd or self.root,
                              capture_output=True, text=True, check=True).stdout.strip()

    def write(self, name, text):
        (self.root / name).write_text(text, encoding="utf-8")

    def runmap(self, *args, code=0, event=None):
        p = subprocess.run([sys.executable, str(self.root / "scripts" / "codemap.py"), *args],
                           cwd=self.root, input=json.dumps(event) if event is not None else "",
                           text=True, capture_output=True, timeout=30)
        self.assertEqual(p.returncode, code, p.stdout + p.stderr)
        return p.stdout + p.stderr

    def test_create_modify_add_delete(self):
        self.runmap("--check", code=1)
        self.runmap()
        self.assertIn("old", self.map.read_text())
        first = self.map.read_bytes()
        self.write("example.py", "def old():\n    return 2\n")
        self.runmap("--check", code=1)
        self.runmap()
        self.assertNotEqual(first, self.map.read_bytes())
        self.runmap("--check")
        self.write("new.ts", "export function fresh() {}\n")
        self.runmap()
        self.assertIn("new.ts", self.map.read_text())
        (self.root / "example.py").unlink()
        self.runmap()
        self.assertNotIn("example.py", self.map.read_text())
        self.runmap("--check")

    def test_preserves_overview_ignores_secrets_and_noop(self):
        self.runmap()
        self.map.write_text(self.map.read_text().replace("## Overview", "## Overview\nHandwritten notes"))
        self.write(".env", "TOKEN=private\n")
        self.runmap()
        self.assertIn("Handwritten notes", self.map.read_text())
        self.assertNotIn("TOKEN=private", self.map.read_text())
        stamp = self.map.stat().st_mtime_ns
        self.runmap()
        self.assertEqual(stamp, self.map.stat().st_mtime_ns)
        self.runmap("--check")

    def test_before_read_refreshes_only_map(self):
        self.runmap()
        self.write("example.py", "def new():\n    return 1\n")
        self.runmap("--before-read", event={"tool_input": {"file_path": str(self.root / "example.py")}})
        self.runmap("--check", code=1)
        self.runmap("--before-read", event={"tool_input": {"file_path": str(self.map)}})
        self.runmap("--check")
        self.assertIn(" | new", self.map.read_text())

    def test_remote_change_detected_then_synced(self):
        remote = Path(self.temp.name) / "remote.git"
        self.git("init", "--bare", str(remote))
        self.git("remote", "add", "origin", str(remote))
        self.git("push", "-u", "origin", "work")
        self.runmap()
        self.assertIn("upstream matches", self.runmap("--check", "--remote"))
        other = Path(self.temp.name) / "other"
        self.git("clone", "-b", "work", str(remote), str(other))
        self.git("config", "user.name", "Other", cwd=other)
        self.git("config", "user.email", "other@example.invalid", cwd=other)
        (other / "remote.py").write_text("def remote_change():\n    pass\n")
        self.git("add", ".", cwd=other)
        self.git("commit", "-qm", "remote change", cwd=other)
        self.git("push", cwd=other)
        head = self.git("rev-parse", "HEAD")
        self.assertIn("No pull performed", self.runmap("--check", "--remote", code=1))
        self.assertEqual(head, self.git("rev-parse", "HEAD"))
        self.assertFalse((self.root / "remote.py").exists())
        self.git("pull", "--ff-only")
        self.runmap("--check", code=1)
        self.runmap()
        self.assertIn("remote.py", self.map.read_text())
        self.runmap("--check", "--remote")

    def test_corruption_and_failure_not_green(self):
        self.runmap()
        self.map.write_text(self.map.read_text().replace("example.py", "wrong.py"))
        self.runmap("--check", code=1)
        self.runmap()
        self.runmap("--check")
        shutil.rmtree(self.root / ".git")
        self.runmap(code=1)

    def test_parallel_refresh(self):
        procs = [subprocess.Popen([sys.executable, str(self.root / "scripts" / "codemap.py")],
                                  cwd=self.root, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                 for _ in range(4)]
        for proc in procs:
            _, err = proc.communicate(timeout=30)
            self.assertEqual(proc.returncode, 0, err)
        self.runmap("--check")


if __name__ == "__main__":
    unittest.main()
