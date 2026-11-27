#!/usr/bin/env python3
"""One deduplicated requirement ledger and one completion calculation, generated from the repository.

Units (each counted once; identifier namespaces are disjoint):
  REQ   266 original requirements (plan.md Appendix A; coding state from PROGRESS.md Appendix E)
  ARCH  84 architecture concepts (plan.md Appendix B; evidence/2026-11-23-traceability/architecture-ledger.json)
  SEC   208 threat-triage rows (docs/OCADE_THREAT_TRIAGE.md), explicit "as X" rows counted once
  REPO  72 repository-integration entries (plan.md Part 14A, `#### REPO-nn`)
  UX    34 UX laws (plan.md Appendix G.1)
  P27/28 named product features (R12, packages, T12, named concepts)
Part 0A (148 tasks) and both master checklists are views over these units and are never counted.

Classes: VERIFIED (a named test ran and passed on this checkout; see scripts/test-evidence.py), PARTIAL, NOT_IMPLEMENTED,
BROKEN, UNVERIFIED (recorded as implemented, no row-level proof on this checkout), BLOCKED (owner or external
dependency). Excluded from the coding percentage: N/A, DUPLICATE, STANDING (gate rules), QUALIFICATION (measurement or
real-device proof; its harness code is a REQ unit).
Usage: python3 scripts/requirements-ledger.py --results OUT.json [--write]
"""
import collections
import importlib.util
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("coding_audit", os.path.join(ROOT, "scripts/coding-audit.py"))
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

BLOCK_WORDS = re.compile(r"owner|provider|real[ -](?:model|device|provider|attacker|pc)|hardware|staging|stage [45]|certificate|antivirus|engine choice|hosted|consumer|signing|payment|campaign|live[ -]model|weak-model|part 23 gate|macos|windows|not deployed|qualif", re.I)
ALL = ("VERIFIED", "PARTIAL", "NOT_IMPLEMENTED", "BROKEN", "UNVERIFIED", "BLOCKED")
EXCL = ("N/A", "DUPLICATE", "STANDING", "QUALIFICATION")
units: list[dict] = []


def add(ns, ident, status, basis, title=""):
    units.append({"ns": ns, "id": ident, "status": status, "basis": basis, "title": title})


def read(path):
    return open(os.path.join(ROOT, path), encoding="utf-8").read()


def main() -> int:
    results = json.load(open(sys.argv[sys.argv.index("--results") + 1])) if "--results" in sys.argv else None
    # SEC
    sec = audit.compute(results)
    for ident, v in sec.items():
        t, verdict = v["triage"], v["verdict"]
        if v.get("alias_of"):
            add("SEC", ident, "DUPLICATE", f"same evidence as {v['alias_of']}")
        elif t == "N/A":
            add("SEC", ident, "N/A", "triage: not applicable to this product")
        elif t == "OWNER":
            add("SEC", ident, "BLOCKED", "triage: owner or provider decision")
        elif t == "OPEN":
            add("SEC", ident, "BLOCKED" if BLOCK_WORDS.search(v["evidence"]) else "NOT_IMPLEMENTED", v["evidence"][:420])
        elif t == "PARTIAL":
            add("SEC", ident, "BLOCKED" if BLOCK_WORDS.search(v["evidence"]) else "PARTIAL", v["evidence"][:420])
        elif verdict in ("VERIFIED", "BROKEN", "UNVERIFIED"):
            add("SEC", ident, verdict, "tests " + ", ".join(v["all_tests"][:3]) if verdict == "VERIFIED" else f"cited tests not all passing here: {v.get('test_states')}")
        else:
            add("SEC", ident, "UNVERIFIED", f"{verdict}: no cited test run proves it")
    # REQ
    plan = read("plan.md").split("\n")
    a0 = next(i for i, l in enumerate(plan) if l.startswith("## Appendix A"))
    b0 = next(i for i, l in enumerate(plan) if l.startswith("## Appendix B"))
    prog = read("PROGRESS.md").split("\n")
    e_state = {}
    for l in prog:
        m = re.match(r"^\|\s*(\d+)\s*\|\s*([A-Z\- ]+?)\s*\|\s*([^|]*?)\s*\|", l)
        if m:
            e_state[int(m[1])] = m[2]
    for l in plan[a0:b0]:
        m = re.match(r"^(\d+)\. `([A-Z ]+)` · \*\*([^*]*)\*\* — (.*)", l)
        if not m:
            continue
        n, st, dest, text = int(m[1]), m[2], m[3], m[4][:90]
        cls = e_state.get(n)
        if cls == "STANDING":
            add("REQ", f"REQ-{n:03d}", "STANDING", "gate rule checked at every gate", text)
        elif cls == "QUALIFICATION-ONLY":
            add("REQ", f"REQ-{n:03d}", "QUALIFICATION", "needs measurement or real-device run; harness is coded", text)
        elif cls == "EXCLUDED" or st == "EXCLUDED":
            add("REQ", f"REQ-{n:03d}", "N/A", "excluded from this release", text)
        elif cls == "CODE":
            add("REQ", f"REQ-{n:03d}", "UNVERIFIED", "ledger: BUILDS (coded, coding gate green when recorded); no row-to-test proof here", text)
        elif st == "PASS":
            add("REQ", f"REQ-{n:03d}", "UNVERIFIED", "historical runtime PASS (5 Nov); not current evidence", text)
        else:
            add("REQ", f"REQ-{n:03d}", "NOT_IMPLEMENTED", f"plan status {st}, no coding-ledger row (optional or not coded)", text)
    # ARCH
    for c in json.load(open(os.path.join(ROOT, "evidence/2026-11-23-traceability/architecture-ledger.json"))):
        n, st, reason = c["n"], c["status"], c.get("reason", "")
        if n == 84:
            add("ARCH", "ARCH-084", "QUALIFICATION", "aggregate release gate (zero known critical defects)", c["title"][:90])
        elif st == "PASS":
            tests = [t for t in c.get("tests", []) if t.endswith((".ts", ".py", ".sql"))]
            ok = bool(tests) and results is not None and all(results.get(t, {}).get("status") == "PASS" for t in tests)
            add("ARCH", f"ARCH-{n:03d}", "VERIFIED" if ok else "UNVERIFIED", "tests passed here: " + ", ".join(tests) if ok else "recorded PASS; cited tests not all passing here", c["title"][:90])
        else:
            add("ARCH", f"ARCH-{n:03d}", "BLOCKED" if BLOCK_WORDS.search(reason) else "PARTIAL", reason[:140], c["title"][:90])
    # REPO
    deferred = {12, 31, 40, 52, 62, 72}
    for l in plan:
        m = re.match(r"^#### REPO-(\d+)\. (.*)", l)
        if m:
            n = int(m[1])
            add("REPO", f"REPO-{n:02d}", "BLOCKED" if n in deferred else "UNVERIFIED", "needs live models, hardware or benchmark" if n in deferred else "no REPO id cited in code or tests; per-item audit pending", m[2][:90])
    # UX
    auto = {3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 18, 20, 24, 25, 28, 31, 34}
    for n in range(1, 35):
        add("UX", f"UX-{n:02d}", "UNVERIFIED" if n in auto else "PARTIAL", "automated browser check exists (tests/web/ux_laws_audit.py), not run on this checkout" if n in auto else "source-reviewed only; no automated check or per-route evidence")
    # P27/28
    p = {
        "R12-01": ("PARTIAL", "mode per task coded (20261121150000); native background control beyond pattern-based not coded"),
        "R12-02": ("UNVERIFIED", "coded (20261121140000)"), "R12-03": ("UNVERIFIED", "redaction and purpose binding coded"),
        "R12-04": ("UNVERIFIED", "no unit-named code; may be covered by the MCP catalog"), "R12-05": ("UNVERIFIED", "PermissionGuide coded; no test imports it"),
        "R12-06": ("UNVERIFIED", "generated forms coded"), "R12-07": ("PARTIAL", "discovery presentation not done; context disclosure only"),
        "R12-08": ("UNVERIFIED", "next-step preview coded"), "R12-09": ("UNVERIFIED", "timeline filters coded"), "R12-10": ("UNVERIFIED", "opt-in Do again coded"),
        "R12-11": ("PARTIAL", "forms only"), "R12-12": ("UNVERIFIED", "handoff code exists; no named test"),
        "PKG-01": ("PARTIAL", "built-in read-only skill (packages.ts); no workflow UI or outcome tests"), "PKG-02": ("PARTIAL", "as PKG-01"),
        "PKG-03": ("PARTIAL", "as PKG-01"), "PKG-04": ("PARTIAL", "as PKG-01"),
        "T12-01": ("UNVERIFIED", "LifeOS coded with tests"), "T12-02": ("UNVERIFIED", "stop conditions coded (20261123090000)"), "T12-03": ("UNVERIFIED", "problem-radar.test.ts"),
        "T12-04": ("PARTIAL", "minimal code only"), "T12-05": ("PARTIAL", "minimal code only"), "T12-06": ("UNVERIFIED", "rehearsal mode coded"),
        "T12-07": ("PARTIAL", "passport is unsigned"), "T12-08": ("UNVERIFIED", "checkpoints coded; no unit-named code"),
        "T12-09": ("UNVERIFIED", "no unit-named code; Library and memory may cover it"), "T12-10": ("PARTIAL", "case summary only; no partner network"),
        "T12-11": ("UNVERIFIED", "private skill from a verified task coded"), "T12-12": ("UNVERIFIED", "Time Reclaimed coded"),
        "SkillForge": ("UNVERIFIED", "recording and replay coded; hosted UIA-022 pending"), "CheckPoint": ("UNVERIFIED", "checkpoint code and tests exist"),
        "LegacyBridge": ("NOT_IMPLEMENTED", "PROGRESS: not started, needs owner scoping"), "GhostCursor": ("NOT_IMPLEMENTED", "overlay not started (R12-08 preview exists)"),
        "MiniApps": ("DUPLICATE", "same feature as R12-06 generated forms"), "AntiScam": ("UNVERIFIED", "rule signs coded"),
        "SkillMarketplace": ("BLOCKED", "P2, not approved for launch"), "UIRepairNetwork": ("NOT_IMPLEMENTED", "PROGRESS: not started, P2"),
        "SmartScreen": ("PARTIAL", "live vision coded; native backends unproven"), "IndependentApprovals": ("UNVERIFIED", "approval scopes coded"),
    }
    for k, (st, basis) in p.items():
        add("P27/28", k, st, basis)
    counts = collections.Counter(u["status"] for u in units)
    applicable = [u for u in units if u["status"] in ALL]
    by_ns = collections.defaultdict(collections.Counter)
    for u in units:
        by_ns[u["ns"]][u["status"]] += 1
    n = len(applicable)
    lines = ["| Class | Units | Share of applicable |", "|---|---:|---:|"]
    for k in ALL:
        lines.append(f"| {k} | {counts[k]} | {100 * counts[k] / n:.1f}% |")
    lines.append(f"| **Applicable units** | **{n}** | 100% |")
    remaining = counts["PARTIAL"] + counts["NOT_IMPLEMENTED"] + counts["BROKEN"]
    summary = "\n".join(lines) + "\n\nExcluded from the coding percentage: " + ", ".join(f"{k} {counts[k]}" for k in EXCL) + f". Total units listed: {len(units)}.\n"
    summary += f"\nTotal remaining coding (PARTIAL + NOT_IMPLEMENTED + BROKEN, unblocked): {remaining} ({100 * remaining / n:.1f}%). Verification still owed (UNVERIFIED): {counts['UNVERIFIED']} ({100 * counts['UNVERIFIED'] / n:.1f}%). Blocked: {counts['BLOCKED']} ({100 * counts['BLOCKED'] / n:.1f}%).\n"
    ns_rows = ["| Namespace | " + " | ".join(ALL) + " | excluded | total |", "|---|" + "---:|" * (len(ALL) + 2)]
    for ns, c in by_ns.items():
        ns_rows.append(f"| {ns} | " + " | ".join(str(c[k]) for k in ALL) + f" | {sum(c[k] for k in EXCL)} | {sum(c.values())} |")
    print(summary)
    print("\n".join(ns_rows))
    if "--write" in sys.argv:
        out = ["# OCADE requirement ledger (generated; do not edit by hand)", "",
               "Generated by `python3 scripts/requirements-ledger.py --results <scripts/test-evidence.py output> --write` for one checkout. Every unit is counted once; Part 0A and both master checklists are views over these units. VERIFIED means a named test ran and passed on that checkout; test-file existence is not verification. Method and limits: PROGRESS.md section `Requirement audit`.", "",
               "## Totals", "", summary, "## By namespace", "", "\n".join(ns_rows), ""]
        owner_scoped = re.compile(r"owner scoping|not approved", re.I)
        out += ["## Pending work (every unit that is not VERIFIED, UNVERIFIED or excluded)", "",
                "Actor: `Claude` = codable here without an owner decision; `Owner/external` = needs an owner decision, provider, hardware, platform run or approval. Dependencies and affected files are in the basis text (full evidence is in `docs/OCADE_THREAT_TRIAGE.md` for SEC rows).", "",
                "| ID | Class | Actor | Gap and affected files |", "|---|---|---|---|"]
        for u in units:
            if u["status"] in ("PARTIAL", "NOT_IMPLEMENTED", "BROKEN", "BLOCKED"):
                actor = "Owner/external" if u["status"] == "BLOCKED" or owner_scoped.search(u["basis"]) else "Claude"
                out.append(f"| {u['id']} | {u['status']} | {actor} | {(u['title'] + ' — ' if u['title'] else '') + u['basis']} |".replace("\n", " "))
        out.append("")
        for ns in by_ns:
            out += [f"## {ns}", "", "| ID | Class | Basis |", "|---|---|---|"]
            for u in units:
                if u["ns"] == ns:
                    t = (u["title"] + " — " if u["title"] else "") + u["basis"]
                    out.append(f"| {u['id']} | {u['status']} | {t.replace('|', '/')} |")
            out.append("")
        open(os.path.join(ROOT, "docs/REQUIREMENTS_LEDGER.md"), "w", encoding="utf-8").write("\n".join(out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
