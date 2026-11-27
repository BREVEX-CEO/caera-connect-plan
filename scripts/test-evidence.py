#!/usr/bin/env python3
"""Run every test file on its own and record whether it really passed, for scripts/coding-audit.py --results.

A file counts as PASS only when it exits 0 and at least one of its tests executed (not all skipped).
Runs TypeScript (node --test), companion Python (unittest) and database (psql) tests available on this machine.
Usage: python3 scripts/test-evidence.py OUT.json   (needs PostgreSQL via PG* variables for the .test.sql files)
"""
import glob
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
out: dict[str, dict] = {}


def sh(cmd, cwd=None, timeout=240):
    try:
        p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout)
        return p.returncode, p.stdout + p.stderr
    except subprocess.TimeoutExpired:
        return 124, "timeout"


def num(text, key):
    m = re.search(rf"^# {key} (\d+)", text, re.M)
    return int(m[1]) if m else 0


for f in sorted(glob.glob("tests/**/*.test.ts", recursive=True)):
    rc, text = sh(["node", "--experimental-strip-types", "--no-warnings", "--test", f])
    tests, ok, skip = num(text, "tests"), num(text, "pass"), num(text, "skipped")
    out[f] = {"status": "TIMEOUT" if rc == 124 else "PASS" if rc == 0 and ok > 0 else ("SKIPPED" if rc == 0 else "FAIL"), "tests": tests, "pass": ok, "skipped": skip}

for f in sorted(glob.glob("device-agent/windows/tests/test_*.py")):
    mod = "tests." + os.path.basename(f)[:-3]
    rc, text = sh([sys.executable, "-m", "unittest", mod], cwd="device-agent/windows")
    m = re.search(r"Ran (\d+) tests?", text)
    ran = int(m[1]) if m else 0
    s = re.search(r"skipped=(\d+)", text)
    skip = int(s[1]) if s else 0
    out[f] = {"status": "TIMEOUT" if rc == 124 else "PASS" if rc == 0 and ran - skip > 0 else ("SKIPPED" if rc == 0 else "FAIL"), "tests": ran, "pass": ran - skip, "skipped": skip}

db = f"ocade_evidence_{os.getpid()}"
psql = lambda *a: sh(["psql", "-q", "-X", "-v", "ON_ERROR_STOP=1", *a])
psql("-d", "postgres", "-c", f"CREATE DATABASE {db}")
try:
    psql("-d", db, "-f", "tests/jarvis/db/supabase-stub.sql")
    bad = [m for m in sorted(glob.glob("supabase/migrations/*.sql")) if psql("-d", db, "-f", m)[0] != 0]
    out["_migrations_failed"] = bad
    for f in sorted(glob.glob("tests/jarvis/db/*.test.sql")):
        rc, text = psql("-d", db, "-f", f)
        out[f] = {"status": "PASS" if rc == 0 else "FAIL", "tests": 1, "pass": int(rc == 0), "skipped": 0}
finally:
    psql("-d", "postgres", "-c", f"DROP DATABASE IF EXISTS {db} WITH (FORCE)")
json.dump(out, open(sys.argv[1], "w"), indent=1, sort_keys=True)
print({k: sum(1 for v in out.values() if isinstance(v, dict) and v["status"] == k) for k in ("PASS", "FAIL", "SKIPPED", "TIMEOUT")})
