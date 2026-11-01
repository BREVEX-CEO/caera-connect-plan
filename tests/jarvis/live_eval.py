"""Unseen real-task evaluation for JARVIS (plan.md 198-205). Test-only; never shipped.

Each generator builds a fresh, randomized problem in a disposable workspace and returns the
person's request, the grants it needs, and a hidden oracle that checks the real result. The
request and files are all the product sees; oracles and seeds stay here. Every task runs ONCE
through scripts/jarvis-live.mjs (real Gemini, staging authority, companion as an unprivileged
user), so the reported rate is first-attempt success.

    python3 tests/jarvis/live_eval.py --seed 7 --out evidence/<dir> [--only name ...]
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import os
import random
import shutil
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
USER = os.environ.get("OCADE_EVAL_USER", "ocadelive")
WORDS = ["amber", "birch", "cobalt", "delta", "ember", "fjord", "garnet", "harbor", "indigo", "juniper",
         "kestrel", "lumen", "meadow", "nimbus", "onyx", "prairie", "quartz", "russet", "sierra", "tundra"]


def word(rng: random.Random) -> str:
    return rng.choice(WORDS)


def note_text(ws: Path) -> str:
    """Everything a person could read as a note: text files, Word documents and PDFs."""
    from docx import Document
    from pypdf import PdfReader

    parts = []
    for path in ws.rglob("*"):
        if not path.is_file() or "originals" in path.parts:
            continue
        if path.suffix in (".txt", ".md"):
            parts.append(path.read_text(errors="replace"))
        elif path.suffix == ".docx":
            parts.append("\n".join(p.text for p in Document(path).paragraphs))
        elif path.suffix == ".pdf":
            parts.append("\n".join(page.extract_text() or "" for page in PdfReader(path).pages))
    return "\n".join(parts)


def run_as_user(args: list[str], cwd: Path, timeout: int = 60) -> subprocess.CompletedProcess:
    return subprocess.run(["runuser", "-u", USER, "--", *args], cwd=cwd, capture_output=True, text=True, timeout=timeout)


# ---- generators: (setup(workspace, rng) -> (request, grants, oracle(workspace) -> (bool, str))) ----

def config_repair(ws: Path, rng: random.Random):
    column = f"{word(rng)}_total"
    values = [round(rng.uniform(5, 900), 2) for _ in range(rng.randint(4, 9))]
    out_name = f"{word(rng)}_summary.txt"
    (ws / "data.csv").write_text("day," + column + "\n" + "".join(f"d{i},{v}\n" for i, v in enumerate(values)))
    # Two faults: a trailing comma, and a column name that no longer matches the data.
    (ws / "settings.json").write_text(json.dumps({"input": "data.csv", "column": "total", "output": out_name},
                                                 indent=2)[:-2] + ",\n}")
    (ws / "summarize.py").write_text(
        "import csv, json\ncfg = json.load(open('settings.json'))\n"
        "rows = list(csv.DictReader(open(cfg['input'])))\n"
        "total = sum(float(r[cfg['column']]) for r in rows)\n"
        "open(cfg['output'], 'w').write(f'rows={len(rows)} total={total:.2f}\\n')\n")
    expect = f"rows={len(values)} total={sum(values):.2f}"

    def oracle(ws: Path):
        result = run_as_user([sys.executable, "summarize.py"], ws)
        produced = list(ws.rglob(out_name))
        text = produced[0].read_text().strip() if produced else ""
        return result.returncode == 0 and text == expect, f"exit {result.returncode}, got {text!r}, want {expect!r}"

    return "summarize.py in my JARVIS folder stopped working. Fix it so it produces its summary again.", \
        ["computer_control"], oracle


def crlf_script(ws: Path, rng: random.Random):
    folder, archive = word(rng) + "_notes", f"{word(rng)}-backup.tar.gz"
    (ws / folder).mkdir()
    names = [f"{word(rng)}{i}.txt" for i in range(rng.randint(2, 4))]
    for name in names:
        (ws / folder / name).write_text(f"note {name}\n")
    (ws / "backup.sh").write_bytes(f"#!/bin/sh\r\nset -e\r\ntar -czf {archive} {folder}\r\necho done\r\n".encode())
    os.chmod(ws / "backup.sh", 0o644)

    def oracle(ws: Path):
        (ws / archive).unlink(missing_ok=True)
        result = run_as_user(["./backup.sh"], ws)
        listed = subprocess.run(["tar", "-tzf", str(ws / archive)], capture_output=True, text=True).stdout if (ws / archive).exists() else ""
        ok = result.returncode == 0 and all(f"{folder}/{n}" in listed for n in names)
        return ok, f"exit {result.returncode}, archive lists {listed.split()}"

    return "backup.sh in my JARVIS folder won't run. Fix it so it runs and makes its backup.", ["computer_control"], oracle


def dedupe_contacts(ws: Path, rng: random.Random):
    people = rng.sample([("Ada", "Lovelace"), ("Grace", "Hopper"), ("Alan", "Turing"), ("Katherine", "Johnson"),
                         ("Edsger", "Dijkstra"), ("Barbara", "Liskov"), ("Donald", "Knuth"), ("Margaret", "Hamilton")],
                        rng.randint(4, 7))
    rows = []
    for index, (first, last) in enumerate(people):
        email = f"{first.lower()}.{last.lower()}@{word(rng)}.test"
        rows.append([f"{first} {last}", email])
        for _ in range(rng.randint(1 if index == 0 else 0, 2)):  # at least one duplicate
            rows.append([f" {first.lower()} {last} ", email.upper() if rng.random() < .5 else f" {email}"])
    rng.shuffle(rows)
    buffer = io.StringIO()
    csv.writer(buffer).writerows([["name", "email"], *rows])
    name = f"{word(rng)}_contacts.csv"
    (ws / name).write_text(buffer.getvalue())

    def oracle(ws: Path):
        outputs = [p for p in ws.rglob("*") if p.is_file() and p.suffix in (".csv", ".txt", ".md")
                   and "originals" not in p.parts]
        for path in outputs:
            lines = path.read_text(errors="replace").lower().splitlines()
            counts = [sum(f"{f.lower()}.{l.lower()}@" in line for line in lines) for f, l in people]
            if all(c == 1 for c in counts):
                return True, path.name
        return False, f"no list with each person once among {[p.name for p in outputs]}"

    return f"{name} has the same people in it more than once. Give me a clean list with each person only once.", [], oracle


def totals_workbook(ws: Path, rng: random.Random):
    clients = rng.sample(["Harbor Cafe", "Northwind Labs", "Blue Fern Studio", "Quartz Legal", "Sierra Bikes"], 3)
    folder = ws / f"{word(rng)}_invoices"
    folder.mkdir()
    totals = dict.fromkeys(clients, 0.0)
    for n in range(rng.randint(5, 8)):
        client, amount = rng.choice(clients), round(rng.uniform(20, 3000), 2)
        void = rng.random() < 0.15
        if not void:
            totals[client] += amount
        style = n % 3
        if style == 0:
            text = f"INVOICE {1000 + n}\nClient: {client}\nTotal due: ${amount:,.2f}\n" + ("NOTE: void, do not bill\n" if void else "")
            (folder / f"inv-{1000 + n}.txt").write_text(text)
        elif style == 1:
            (folder / f"inv-{1000 + n}.json").write_text(json.dumps({"customer": client, "total": amount, "void": void}))
        else:
            (folder / f"inv-{1000 + n}.txt").write_text(f"#{1000 + n} | client={client} | amount={amount} USD" + (" | VOID" if void else "") + "\n")

    def oracle(ws: Path):
        import openpyxl

        for path in ws.rglob("*.xlsx"):
            values = [c for row in openpyxl.load_workbook(path, data_only=True).active.iter_rows(values_only=True) for c in row]
            numbers = [round(v, 2) for v in values if isinstance(v, (int, float))]
            missing = [c for c, t in totals.items() if t and round(t, 2) not in numbers]
            return not missing, f"{path.name}: numbers {numbers}, expected {totals}"
        return False, "no workbook"

    return f"Make me an Excel workbook that totals what each client owes from the invoices in {folder.name}.", [], oracle


def log_cause(ws: Path, rng: random.Random):
    job, at = word(rng) + "-sync", f"0{rng.randint(1, 5)}:{rng.randint(10, 59)}"
    cause = rng.choice([("certificate has expired", "certificate"), ("connection refused by db-7:5432", "refused"),
                        ("No space left on device", "space")])
    lines = [f"2026-10-31T{h:02d}:{m:02d}:00Z INFO web GET /health 200" for h in range(24) for m in (0, 30)]
    lines.insert(rng.randint(3, 40), f"2026-10-31T{at}:12Z ERROR {job}: run failed: {cause[0]}")
    (ws / f"{word(rng)}.log").write_text("\n".join(lines) + "\n")

    def oracle(ws: Path):
        text = note_text(ws).lower()
        return cause[1] in text and at in text, f"note text {text[:120]!r}"

    return f"The {job} job failed last night. Find out why from the log in my folder and write the cause and time in a short note.", [], oracle


def yaml_to_json(ws: Path, rng: random.Random):
    data = {"service": {"name": f"{word(rng).title()} API", "port": rng.randint(1024, 9999),
                        "regions": rng.sample(["eu-west", "us-east", "ap-south", "sa-east"], 2)},
            "flags": {"beta": rng.random() < .5, "audit": rng.random() < .5}}
    yaml = (f"service:\n  name: {data['service']['name']}\n  port: {data['service']['port']}\n  regions:\n"
            + "".join(f"    - {r}\n" for r in data["service"]["regions"])
            + f"flags:\n  beta: {str(data['flags']['beta']).lower()}\n  audit: {str(data['flags']['audit']).lower()}\n")
    stem = word(rng)
    (ws / f"{stem}.yaml").write_text(yaml)

    def oracle(ws: Path):
        for path in ws.rglob("*.json"):
            try:
                if json.loads(path.read_text()) == data:
                    return True, path.name
            except ValueError:
                continue
        return False, "no equal JSON"

    return f"Convert {stem}.yaml into a JSON file with the same settings.", [], oracle


def failing_test(ws: Path, rng: random.Random):
    factor = rng.randint(2, 9)
    (ws / "pricing.py").write_text(f"def discounted(price, percent):\n    return round(price - price * percent / {factor * 10}, 2)\n")
    cases = [(round(rng.uniform(10, 500), 2), rng.choice([5, 10, 15, 20, 25])) for _ in range(3)]
    (ws / "test_pricing.py").write_text("from pricing import discounted\n" + "".join(
        f"assert discounted({p}, {d}) == {round(p - p * d / 100, 2)}\n" for p, d in cases) + "print('all tests passed')\n")

    def oracle(ws: Path):
        tests = (ws / "test_pricing.py").read_text()
        result = run_as_user([sys.executable, "test_pricing.py"], ws)
        untouched = all(f"discounted({p}, {d})" in tests for p, d in cases)
        return result.returncode == 0 and untouched, f"exit {result.returncode}, tests untouched {untouched}"

    return "My tests in test_pricing.py fail. Fix the bug in the code (not the tests) so they pass.", ["computer_control"], oracle


def biggest_files(ws: Path, rng: random.Random):
    sizes = rng.sample(range(200_000, 9_000_000, 37_000), 6)
    files = []
    for i, size in enumerate(sizes):
        sub = ws / word(rng) / word(rng)
        sub.mkdir(parents=True, exist_ok=True)
        path = sub / f"{word(rng)}{i}.{rng.choice(['bin', 'dat', 'tmp', 'mov'])}"
        path.write_bytes(os.urandom(size))
        files.append(path)
    top = sorted(files, key=lambda p: p.stat().st_size, reverse=True)[:3]

    def oracle(ws: Path):
        text = note_text(ws)
        return all(p.name in text for p in top), f"want {[p.name for p in top]}"

    return "My JARVIS folder is getting full. Find the three biggest files and list them with their sizes in a short note.", [], oracle


def port_conflict(ws: Path, rng: random.Random):
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    marker = f"{word(rng).title()} board ready {rng.randint(100, 999)}"
    (ws / "board.py").write_text(
        "from http.server import BaseHTTPRequestHandler, HTTPServer\n"
        "class P(BaseHTTPRequestHandler):\n    def do_GET(self):\n        self.send_response(200); self.end_headers()\n"
        f"        self.wfile.write({marker!r}.encode())\n"
        f"HTTPServer(('127.0.0.1', {port}), P).serve_forever()\n")
    subprocess.Popen(["runuser", "-u", USER, "--", "setsid", sys.executable, "-c",
                      f"import socket,time; s=socket.socket(); s.bind(('127.0.0.1',{port})); s.listen(); time.sleep(3600)"],
                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)

    def oracle(ws: Path):
        try:
            body = urllib.request.urlopen(f"http://127.0.0.1:{port}/", timeout=5).read().decode()
        except Exception as error:
            return False, f"not serving: {error}"
        return body == marker and (ws / "board.py").read_text().count(str(port)) == 1, body

    return "My board.py page won't start. Find out why, fix it, and leave it running at its usual address.", ["computer_control"], oracle


def markdown_doc(ws: Path, rng: random.Random):
    title = f"{word(rng).title()} {word(rng).title()} Plan"
    heads = rng.sample(["Goals", "Risks", "Owners", "Budget", "Timeline", "Open questions"], 3)
    (ws / "plan.md").write_text(f"# {title}\n\n" + "".join(f"## {h}\n- {word(rng)} {word(rng)}\n\n" for h in heads))

    def oracle(ws: Path):
        from docx import Document

        for path in ws.rglob("*.docx"):
            paragraphs = [(p.style.name, p.text) for p in Document(path).paragraphs if p.text]
            styled = {t for s, t in paragraphs if s.startswith(("Heading", "Title"))}
            return title in styled and all(h in styled for h in heads), str(paragraphs[:6])
        return False, "no docx"

    return "Turn my plan.md into a Word document that keeps its title and headings.", [], oracle


def web_fact(ws: Path, rng: random.Random):
    def oracle(ws: Path):
        page = urllib.request.urlopen("https://www.python.org/downloads/", timeout=20).read().decode()
        import re

        latest = re.search(r"Download Python (\d+\.\d+\.\d+)", page).group(1)
        text = note_text(ws)
        return latest in text, f"want {latest}, notes {text[:120]!r}"

    return ("Check python.org for the newest stable Python 3 release and save its version number in a short note in my folder.",
            ["browser", "site:www.python.org"], oracle)


GENERATORS = {f.__name__: f for f in (config_repair, crlf_script, dedupe_contacts, totals_workbook, log_cause,
                                      yaml_to_json, failing_test, biggest_files, port_conflict, markdown_doc, web_fact)}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", type=int, required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--only", nargs="*")
    parser.add_argument("--selfcheck", action="store_true", help="every oracle must FAIL on the untouched problem")
    args = parser.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    results = []
    for name, generate in GENERATORS.items():
        if args.only and name not in args.only:
            continue
        rng = random.Random(f"{args.seed}:{name}")
        ws = Path(f"/tmp/ocade-eval/{args.seed}/{name}")
        shutil.rmtree(ws, ignore_errors=True)
        ws.mkdir(parents=True)
        request, grants, oracle = generate(ws, rng)
        subprocess.run(["chown", "-R", USER, str(ws)], check=True)
        if args.selfcheck:
            ok, detail = oracle(ws)
            print(f"{name}: oracle on the untouched problem {'PASSES (broken oracle!)' if ok else 'fails, as it must'}")
            results.append({"task": name, "pass": not ok, "detail": detail[:200]})
            continue
        report = out / f"{name}.json"
        command = ["node", "scripts/jarvis-live.mjs", "--workspace", str(ws), "--agent-user", USER, "--confirm-effects",
                   "--rounds", "40", "--report", str(report)]
        for grant in grants:
            command += ["--grant", grant]
        env = dict(os.environ, OCADE_LIVE_EMAIL=f"ocade-eval-{args.seed}-{name}-{int(time.time())}@example.com")
        started = time.monotonic()
        subprocess.run([*command, request], cwd=ROOT, env=env, capture_output=True, timeout=1500)
        try:
            ok, detail = oracle(ws)
        except Exception as error:
            ok, detail = False, f"oracle error {type(error).__name__}: {error}"
        live = json.loads(report.read_text()) if report.exists() else {}
        timing = live.get("timing") or {}
        results.append({"task": name, "pass": ok, "detail": detail[:300], "settled": live.get("status"),
                        "elapsedMs": timing.get("totalElapsedMs"), "modelCalls": timing.get("modelCalls"),
                        "wallSeconds": round(time.monotonic() - started, 1)})
        print(json.dumps(results[-1]), flush=True)
    passed = sum(r["pass"] for r in results)
    summary = {"seed": args.seed, "passed": passed, "total": len(results),
               "commit": subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, capture_output=True,
                                        text=True).stdout.strip(), "results": results}
    (out / "summary.json").write_text(json.dumps(summary, indent=2))
    print(f"{'oracles failing on untouched problems' if args.selfcheck else 'first-attempt verified success'} {passed}/{len(results)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
