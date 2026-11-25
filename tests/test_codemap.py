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

    def test_ast_query_and_real_bug_fix(self):
        # Reproduce a missing typed export and a broken import, then repair the import.
        self.write("auth.ts", "export const login: () => number = () => 1;\n")
        self.write("route.ts", 'import { login } from "./missing";\nexport function run() { return login(); }\n')
        first = self.runmap("--query", "login", "--require-ast")
        self.assertIn("FUNCTION login | auth.ts:1", first)
        self.assertNotIn("route.ts:1 => auth.ts", first)
        self.write("route.ts", 'import { login } from "./auth";\nexport function run() { return login(); }\n')
        result = self.runmap("--trace", "login", "--require-ast")
        self.assertIn("route.ts:1 => auth.ts", result)
        self.assertIn("route.ts:2 => auth.ts", result)
        self.assertIn("[INFERRED]", result)
        self.assertIn("EXPORT login | auth.ts:1", self.map.read_text())
        self.runmap("--check", "--require-ast")

    def test_route_database_security_test_impact_and_path(self):
        self.write("api.ts", 'export function load() { return db.from("profiles"); }\n')
        self.write("route.ts", 'import { load } from "./api";\nexport const Route = createFileRoute("/login")({ loader: load });\n')
        self.write("schema.sql", 'CREATE TABLE public.profiles(id int);\nALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;\nCREATE POLICY p ON public.profiles USING (true);\n')
        self.write("api.test.ts", 'import { load } from "./api";\nload();\n')
        self.runmap("--require-ast")
        text = self.map.read_text()
        self.assertIn("ROUTE /login | route.ts:2", text)
        self.assertIn("api.ts:1 => schema.sql", text)
        self.assertIn("POLICY public.profiles | schema.sql:3", text)
        self.assertIn("TESTS api.test.ts", self.runmap("--tests", "api.ts"))
        self.assertIn("IMPACT route.ts", self.runmap("--impact", "api.ts"))
        self.assertIn("route.ts => api.ts => schema.sql", self.runmap("--path", "route.ts", "schema.sql"))

    def test_incremental_reuse_and_deleted_relationship(self):
        self.write("other.py", "from example import old\nold()\n")
        first = json.loads(self.runmap("--stats"))
        self.assertGreater(first["parsed"], 0)
        warm = json.loads(self.runmap("--stats"))
        self.assertEqual(warm["parsed"], 0)
        self.assertEqual(warm["read_bytes"], 0)
        self.write("example.py", "def new():\n    return 1\n")
        update = json.loads(self.runmap("--stats"))
        self.assertEqual(update["parsed"], 1)
        (self.root / "example.py").unlink()
        self.assertIn("No indexed matches", self.runmap("--query", "example.py"))
        self.assertNotIn("=> example.py", self.map.read_text())
        self.runmap("--check")

    def test_cycles_and_bounded_queries(self):
        self.write("a.ts", 'import "./b";\nexport function alpha() {}\n')
        self.write("b.ts", 'import "./a";\nexport function beta() {}\n')
        self.runmap("--require-ast")
        self.assertIn("CYCLE a.ts => b.ts => a.ts", self.map.read_text())
        self.assertLessEqual(len(self.runmap("--query", "a.ts", "--budget", "50")), 151)
        self.assertLessEqual(len(self.runmap("--summary")), 4201)
        self.runmap("--guard-read", code=2, event={"tool_input": {"file_path": str(self.map)}})
        self.runmap("--guard-read", event={"tool_input": {"file_path": str(self.map), "limit": 100}})

    def test_diagnostics_disappear_after_repair(self):
        self.write("api.ts", "export function load() {}\n")
        self.write("route.ts", 'import { load } from "./missing";\nload();\n')
        self.runmap("--require-ast")
        self.assertIn("UNRESOLVED IMPORT ./missing", self.map.read_text())
        self.assertIn("UNRESOLVED IMPORT ./missing", self.runmap("--diagnostics"))
        self.write("route.ts", 'import { load } from "./api";\nload();\n')
        self.assertIn("No indexed import diagnostics", self.runmap("--diagnostics"))
        self.assertNotIn("UNRESOLVED IMPORT ./missing", self.map.read_text())
        self.assertIn("route.ts:2 => api.ts", self.runmap("--trace", "load"))
        self.runmap("--check", "--require-ast")

    def test_missing_export_and_reexport(self):
        self.write("api.ts", "export function load() {}\n")
        self.write("barrel.ts", 'export { load } from "./api";\n')
        self.write("route.ts", 'import { load } from "./barrel";\nload();\n')
        self.assertIn("No indexed import diagnostics", self.runmap("--diagnostics", "--require-ast"))
        self.write("api.ts", "export function renamed() {}\n")
        self.assertIn("EXPORT NOT INDEXED load", self.runmap("--diagnostics", "--require-ast"))
        self.assertNotIn("EDGE call | barrel.ts", self.map.read_text())
        self.write("barrel.ts", 'export { renamed as load } from "./api";\n')
        self.assertIn("No indexed import diagnostics", self.runmap("--diagnostics", "--require-ast"))
        self.runmap("--check", "--require-ast")

    def test_context_fuzzy_and_corrupt_cache_recovery(self):
        self.write("settings.ts", "export function refreshPreference() {}")
        result = self.runmap("--query", "where is refresh prefernce", "--require-ast")
        self.assertIn("FUNCTION refreshPreference | settings.ts:1", result)
        cache = self.root / ".git" / "codemap-v2.json"
        receipt, payload = cache.read_bytes().split(b"\n", 1)
        cache.write_bytes(receipt + b"\n" + payload[:-1] + bytes([payload[-1] ^ 1]))
        result = self.runmap("--query", "refreshPreference", "--stats", "--require-ast")
        self.assertGreater(json.loads(result.splitlines()[0])["parsed"], 1)
        self.assertIn("FUNCTION refreshPreference | settings.ts:1", result)

    def test_local_calls_parse_errors_and_review_candidates(self):
        self.write("feature.ts", "export function feature() { helper(); }\nfunction helper() {}\nfunction spare() {}")
        self.write("broken.ts", "export const broken = ;")
        self.assertIn("PARSE-ERROR TS", self.runmap("--diagnostics"))
        self.assertIn("broken.ts:1", self.runmap("--diagnostics"))
        trace = self.runmap("--trace", "helper")
        self.assertIn("feature => helper:2 [INFERRED LOCAL]", trace)
        unused = self.runmap("--unused")
        self.assertIn("spare | feature.ts:3", unused)
        self.assertNotIn("helper", unused)
        self.write("broken.ts", "export const broken = 1;")
        self.assertNotIn("broken.ts:1", self.runmap("--diagnostics"))

    def test_route_concepts_rank_over_unrelated_verification(self):
        routes = self.root / "routes"
        routes.mkdir()
        self.write("routes/auth.verify.ts", 'export const Route = createFileRoute("/auth/verify");')
        self.write("worker.ts", "export function checkWorkVerification() {}")
        output = self.runmap("--query", "how does login verification work", "--require-ast")
        self.assertIn("routes/auth.verify.ts:1", output.splitlines()[1])

    def test_rename_refreshes_scoped_calls_and_recovers_render(self):
        self.write("feature.ts", """export class Feature {
  run() { this.refresh(); }
  refresh() {}
}
""")
        self.write("consumer.ts", 'import {Feature} from "./feature"; export const current = new Feature();')
        self.runmap("--require-ast")
        self.assertIn("Feature.run => Feature.refresh:3 [INFERRED LOCAL]", self.map.read_text())
        (self.root / "feature.ts").rename(self.root / "new-feature.ts")
        self.write("new-feature.ts", """export class Feature {
  run() { this.reload(); }
  reload() {}
}
""")
        self.write("consumer.ts", 'import {Feature} from "./new-feature"; export const current = new Feature();')
        stats = json.loads(self.runmap("--stats", "--require-ast"))
        self.assertEqual((stats["parsed"], stats["deleted"]), (2, 1))
        correct = self.map.read_bytes()
        self.assertIn(b"Feature.run => Feature.reload:3", correct)
        self.assertIn(b"consumer.ts:1 => new-feature.ts", correct)
        self.assertNotIn(b"Feature.refresh", correct)
        self.assertNotIn(b"FILE feature.ts", correct)
        self.map.write_bytes(correct + b"\xff")
        self.runmap("--check", code=1)
        self.runmap("--query", "Feature.reload")
        self.assertEqual(self.map.read_bytes(), correct)

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
