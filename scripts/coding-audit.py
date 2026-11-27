#!/usr/bin/env python3
"""Evidence-based coding status of the security triage (208 rows), from the repository, not from checkboxes.

For each row of docs/OCADE_THREAT_TRIAGE.md it resolves every file, test and migration the row cites against
the working tree. A FIXED row counts as VERIFIED only when every cited file exists and at least one cited
file is a test. With --results (scripts/test-evidence.py) VERIFIED additionally needs every cited test file to
have actually run and passed; existence alone is not verification. Otherwise it is listed so the gap can be repaired. PARTIAL, OPEN and OWNER rows are reported
as the triage states them. Usage: python3 scripts/coding-audit.py [--json] [--list STATUS]
"""
import collections
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP = {"node_modules", ".git", "__pycache__", "dist", ".wrangler", ".output", ".tanstack", ".claude"}
EXT = (".ts", ".tsx", ".py", ".sql", ".mjs", ".yml", ".yaml", ".sh", ".ps1", ".json", ".toml", ".md", ".html", ".txt", ".css", ".js")


def tree() -> tuple[dict[str, list[str]], set[str]]:
    by_name: dict[str, list[str]] = collections.defaultdict(list)
    migrations: set[str] = set()
    for folder, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in SKIP]
        for name in files:
            path = os.path.relpath(os.path.join(folder, name), ROOT)
            by_name[name].append(path)
            if path.startswith(("supabase/migrations/", "supabase/rollback/")):
                migrations.add(name.split("_")[0])
    return by_name, migrations


def is_test(path: str) -> bool:
    base = os.path.basename(path)
    return (path.startswith("tests/") or "/tests/" in path or base.startswith("test_")
            or ".test." in base or base.endswith("_test.py"))


def test_corpus() -> str:
    parts = []
    for folder, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in SKIP]
        for name in files:
            path = os.path.relpath(os.path.join(folder, name), ROOT)
            if is_test(path) and name.endswith((".ts", ".tsx", ".py", ".sql", ".mjs", ".sh")):
                parts.append(open(os.path.join(folder, name), encoding="utf-8", errors="ignore").read())
    return "\n".join(parts)


def referenced_by_tests(tokens: list[str], corpus: str) -> list[str]:
    """Symbols and files a row cites that some test file mentions by name: weaker than a named test."""
    hits = []
    for token in tokens:
        for piece in re.split(r"[ /()]+", token):
            piece = piece.strip(".,;:`'\"")
            for candidate in {piece.rsplit(".", 1)[0], piece.split(".")[-1], piece.split(".")[0]}:
                if len(candidate) >= 6 and re.search(r"\b" + re.escape(candidate) + r"\b", corpus):
                    hits.append(candidate)
    return sorted(set(hits))[:3]


def compute(results: dict | None = None) -> dict:
    """Per-row verdicts. With results (scripts/test-evidence.py output) a FIXED row is VERIFIED only if every
    cited test file actually passed; a failing one is BROKEN; unrun or skipped ones are UNVERIFIED."""
    by_name, migrations = tree()
    corpus = test_corpus()
    triage = open(os.path.join(ROOT, "docs/OCADE_THREAT_TRIAGE.md"), encoding="utf-8").read()
    rows = re.findall(r"^\| ([A-Z]+-?[A-Z]*-?\d+)\s*\| ([A-Z/]+)\s*\| (.*?) \|?\s*$", triage, re.M)
    result = {}
    for ident, status, evidence in rows:
        cited, missing, tests = [], [], []
        tokens = re.findall(r"`([^`]+)`", evidence)
        for token in tokens:
            token = token.strip().rstrip(",.;")
            if re.fullmatch(r"20\d{12}", token):
                (cited if token in migrations else missing).append(token)
                continue
            name = os.path.basename(token.replace("\\", "/"))
            if name.endswith(EXT):
                paths = by_name.get(name, [])
                if token.count("/") and not any(p.endswith(token) for p in paths):
                    paths = []
                if paths:
                    cited.append(token)
                    tests.extend(p for p in paths if is_test(p))
                else:
                    missing.append(token)
        if status == "FIXED":
            if missing:
                verdict = "EVIDENCE_MISSING"
            elif tests:
                verdict = "VERIFIED"
            elif (named := referenced_by_tests(tokens, corpus)):
                verdict, tests = "TESTED_BY_REFERENCE", named
            else:
                verdict = "NO_TEST_FOUND"
        else:
            verdict = status
        result[ident] = {"triage": status, "verdict": verdict, "missing": missing, "tests": sorted(set(tests))[:3], "all_tests": sorted(set(tests)), "evidence": evidence}
    # "as TENANT-03" inherits that row's verdict.
    for ident, status, evidence in rows:
        reference = re.fullmatch(r"\s*as ([A-Z]+-?[A-Z]*-?\d+)\b.*", evidence)
        if reference and reference[1] in result:
            result[ident]["alias_of"] = reference[1]
        if reference and status == "FIXED" and reference[1] in result:
            result[ident]["verdict"] = result[reference[1]]["verdict"]
            result[ident]["tests"] = result[reference[1]]["tests"]
            result[ident]["all_tests"] = result[reference[1]]["all_tests"]
    if results is not None:
        for v in result.values():
            if v["verdict"] != "VERIFIED":
                continue
            states = [results.get(t, {}).get("status", "NOT_RUN") for t in v["all_tests"]]
            v["test_states"] = dict(zip(v["all_tests"], states))
            if "FAIL" in states:
                v["verdict"] = "BROKEN"
            elif not all(x == "PASS" for x in states):
                v["verdict"] = "UNVERIFIED"
    return result


def main() -> int:
    results = None
    if "--results" in sys.argv:
        results = json.load(open(sys.argv[sys.argv.index("--results") + 1]))
    result = compute(results)
    counts = collections.Counter(v["verdict"] for v in result.values())
    if "--json" in sys.argv:
        print(json.dumps({"counts": counts, "rows": result}, indent=1))
        return 0
    if "--list" in sys.argv:
        want = sys.argv[sys.argv.index("--list") + 1]
        for ident, v in result.items():
            if v["verdict"] == want:
                print(ident, v["missing"] or v["tests"])
        return 0
    total = len(result)
    applicable = total - counts["N/A"] - counts["OWNER"]
    print(f"rows {total}; applicable to code {applicable} (N/A {counts['N/A']}, owner/provider {counts['OWNER']})")
    for key in ("VERIFIED", "TESTED_BY_REFERENCE", "EVIDENCE_MISSING", "NO_TEST_FOUND", "PARTIAL", "OPEN"):
        print(f"  {key:20} {counts[key]:4}  {100 * counts[key] / applicable:5.1f}% of applicable")
    return 0


if __name__ == "__main__":
    sys.exit(main())
