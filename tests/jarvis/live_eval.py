"""Unseen real-task evaluation for JARVIS (plan.md 198-205). Test-only; never shipped.

Each generator builds a fresh, randomized problem in a disposable workspace and returns the
person's request, the grants it needs, and a hidden oracle that checks the real result. The
request and files are all the product sees; oracles and seeds stay here. Every task runs ONCE
through scripts/jarvis-live.mjs (real Gemini, staging authority, companion as an unprivileged
user), so the reported rate is first-attempt success.

    python3 tests/jarvis/live_eval.py --seed 7 --out evidence/<dir> [--only name ...]

Comparison with another assistant or computer-use tool (259): `--external <name>` builds the
same seeded problems, prints each request and its folder for the operator to give to that
tool, and scores the result with the same hidden oracle once the operator says it finished.
The same seed gives every tool identical tasks; the summary records correctness, wall time
and how many times the operator had to step in. No superiority is claimed without a run.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import os
import random
import re
import shutil
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
USER = os.environ.get("OCADE_EVAL_USER", "ocadelive")
PUBLIC_ENVIRONMENT = re.compile(
    r"^(PATH|HOME|LANG|LC_\w+|TZ|DISPLAY|XAUTHORITY|HTTPS?_PROXY|https?_proxy|NO_PROXY|no_proxy|"
    r"PLAYWRIGHT_BROWSERS_PATH|OCADE_BROWSER_EXECUTABLE|OCADE_ALLOW_PRIVATE_WEB|NODE_EXTRA_CA_CERTS)$")
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


def public_environment() -> dict[str, str]:
    """Construct the child environment before any privilege drop, never after it."""
    return {name: value for name, value in os.environ.items() if PUBLIC_ENVIRONMENT.fullmatch(name)}


def run_as_user(args: list[str], cwd: Path, timeout: int = 60) -> subprocess.CompletedProcess:
    return subprocess.run(["runuser", "-u", USER, "--", *args], cwd=cwd, env=public_environment(), capture_output=True, text=True, timeout=timeout)


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
        listed = subprocess.run(["tar", "-tzf", str(ws / archive)], env=public_environment(), capture_output=True, text=True).stdout if (ws / archive).exists() else ""
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
                     env=public_environment(), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
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


def release_pick(ws: Path, rng: random.Random):
    """Target selection (plan.md 46-51, 65): identical 'Download' links in every row of a release
    table; only the row's version and date tell the newest one. The planner sees the page, never
    which row is right."""
    import ssl
    import threading
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

    sys.path.insert(0, str(ROOT / "device-agent/windows"))
    from tests import web_fixture

    product = f"{word(rng).title()}{word(rng).title()}"
    rows = []
    for _ in range(rng.randint(4, 7)):
        version = f"{rng.randint(1, 6)}.{rng.randint(0, 20)}.{rng.randint(0, 9)}"
        date = f"2026-{rng.randint(1, 10):02d}-{rng.randint(1, 28):02d}"
        rows.append((version, date, secrets_token(rng)))
    rng.shuffle(rows)
    newest = max(rows, key=lambda r: tuple(int(n) for n in r[0].split(".")))
    import zipfile

    archives = {}
    for version, date, token in rows:
        content = io.BytesIO()
        with zipfile.ZipFile(content, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("release.txt", f"{product} {version} {date} {token}\n")
        archives[token] = content.getvalue()
    table = "".join(f"<tr><td>{product} {v}</td><td>{d}</td><td><a href='/files/{t}.zip' download>Download</a></td></tr>"
                    for v, d, t in rows)
    page = (f"<!doctype html><title>{product} releases</title><body><h1>{product} releases</h1>"
            f"<table><tr><th>Release</th><th>Date</th><th></th></tr>{table}</table></body>").encode()

    archive_requests = []
    observed_requests = threading.Lock()

    class Site(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def do_GET(self):
            token = self.path.removeprefix("/files/").removesuffix(".zip")
            archive = archives.get(token) if self.path == f"/files/{token}.zip" else None
            if self.path.startswith("/files/"):
                with observed_requests:
                    archive_requests.append(self.path)
            body, kind = (page, "text/html") if self.path == "/" else (archive or b"not found", "application/zip")
            self.send_response(200 if self.path == "/" or archive is not None else 404)
            self.send_header("content-type", kind)
            self.end_headers()
            self.wfile.write(body)

    folder = Path(tempfile_dir())
    cert, key, pin = web_fixture._certificate(folder)
    server = ThreadingHTTPServer(("127.0.0.1", 0), Site)
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(cert, key)
    server.socket = context.wrap_socket(server.socket, server_side=True)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    os.environ["OCADE_ALLOW_PRIVATE_WEB"] = "1"
    os.environ["NODE_EXTRA_CA_CERTS"] = str(folder / "ca.pem")
    wrapper = web_fixture.browser_wrapper(os.environ["OCADE_BROWSER_EXECUTABLE"], pin)
    os.chmod(Path(wrapper).parent, 0o755)
    os.environ["OCADE_EVAL_BROWSER"] = wrapper
    url = f"https://127.0.0.1:{server.server_port}/"

    expected_archive = archives[newest[2]]
    expected_target = f"/files/{newest[2]}.zip"

    def oracle(ws: Path):
        copies = list(ws.rglob("*.zip"))
        if len(copies) != 1 or copies[0].is_symlink() or not copies[0].is_file():
            return False, f"want one regular archive for {newest[:2]}, found {len(copies)}"
        with copies[0].open("rb") as file:
            return file.read(len(expected_archive) + 1) == expected_archive, f"want {newest[:2]}"

    def target_requests():
        with observed_requests:
            return target_selections(archive_requests, expected_target)

    # Neither the expected answer nor these server-side observations enters the planner.
    oracle.target_name = f"{newest[2]}.zip"
    oracle.target_requests = target_requests

    def cleanup():
        server.shutdown()
        server.server_close()
        shutil.rmtree(folder, ignore_errors=True)
        if wrapper != os.environ["OCADE_BROWSER_EXECUTABLE"]:
            shutil.rmtree(Path(wrapper).parent, ignore_errors=True)

    oracle.cleanup = cleanup
    return (f"Download the archive of the newest {product} release from {url} into my folder.",
            ["browser", "site:127.0.0.1"], oracle)


def secrets_token(rng: random.Random) -> str:
    return "".join(rng.choice("abcdef0123456789") for _ in range(10))


def tempfile_dir() -> str:
    import tempfile

    return tempfile.mkdtemp()


def organise_by_type(ws: Path, rng: random.Random):
    """Files and documents: organise a collection (typed fs.manage, nothing lost or replaced)."""
    folder = ws / f"{word(rng)}_downloads"
    folder.mkdir()
    kinds = {"pdf": b"%PDF-1.4 x", "jpg": b"\xff\xd8\xff x", "csv": b"a,b\n1,2\n", "txt": b"note\n"}
    made = {}
    for i in range(rng.randint(7, 11)):
        suffix = rng.choice(list(kinds))
        name = f"{word(rng)}-{i}.{suffix}"
        (folder / name).write_bytes(kinds[suffix] + os.urandom(8))
        made[name] = hashlib.sha256((folder / name).read_bytes()).hexdigest()

    def oracle(ws: Path):
        found = {p.name: p for p in ws.rglob("*") if p.is_file() and p.name in made}
        lost = [n for n in made if n not in found or hashlib.sha256(found[n].read_bytes()).hexdigest() != made[n]]
        loose = [p.name for p in folder.iterdir() if p.is_file()] if folder.exists() else []
        mixed = [str(p.parent.name) for p in found.values()
                 if len({q.suffix for q in p.parent.iterdir() if q.is_file()}) > 1]
        return not lost and not loose and not mixed, f"lost {lost}, still loose {loose}, mixed folders {sorted(set(mixed))}"

    return (f"Tidy up {folder.name}: put the files into one folder per file type inside it. Keep every file.",
            [], oracle)


def editable_totals(ws: Path, rng: random.Random):
    """Files and documents: an editable financial workbook whose totals are formulas."""
    rows = [(word(rng).title(), round(rng.uniform(100, 900), 2)) for _ in range(rng.randint(4, 7))]
    (ws / "expenses.csv").write_text("item,amount\n" + "".join(f"{a},{b}\n" for a, b in rows))
    total = round(sum(b for _, b in rows), 2)

    def oracle(ws: Path):
        import openpyxl

        for path in ws.rglob("*.xlsx"):
            formulas = openpyxl.load_workbook(path)
            values = openpyxl.load_workbook(path, data_only=True)
            for sheet in formulas.worksheets:
                for row in sheet.iter_rows():
                    for cell in row:
                        if isinstance(cell.value, str) and cell.value.startswith("="):
                            result = values[sheet.title][cell.coordinate].value
                            if isinstance(result, (int, float)) and abs(result - total) < 0.01:
                                return True, f"{path.name} {cell.coordinate} {cell.value} = {result}"
            return False, f"{path.name}: no formula giving {total}"
        return False, "no workbook"

    return ("Turn expenses.csv into an Excel workbook where the total is a live formula I can edit, not a typed number.",
            [], oracle)


def report_headings(ws: Path, rng: random.Random):
    """Files and documents: a structured Word report from notes (real headings, real facts)."""
    sections = rng.sample(["Revenue", "Hiring", "Risks", "Customers", "Roadmap", "Costs"], 3)
    facts = {s: f"{word(rng)} {rng.randint(10, 99)}" for s in sections}
    (ws / "notes.md").write_text("".join(f"- {s}: {facts[s]}\n" for s in sections))

    def oracle(ws: Path):
        from docx import Document

        for path in ws.rglob("*.docx"):
            document = Document(path)
            headings = [p.text.strip().lower() for p in document.paragraphs
                        if p.style is not None and (p.style.name or "").lower().startswith("heading")]
            text = "\n".join(p.text for p in document.paragraphs).lower()
            ok = all(any(s.lower() in h for h in headings) for s in sections) and all(
                f.lower() in text for f in facts.values())
            return ok, f"{path.name}: headings {headings}"
        return False, "no docx"

    return (f"Write a Word report from notes.md with one heading for each of {', '.join(sections)} and the facts "
            "under each.", [], oracle)


def extract_across_formats(ws: Path, rng: random.Random):
    """Files and documents: extract information across text, Word and CSV into one list."""
    from docx import Document

    codes = [f"{word(rng)[:3].upper()}-{rng.randint(1000, 9999)}" for _ in range(5)]
    (ws / "a.txt").write_text(f"Order {codes[0]} shipped. Order {codes[1]} pending.\n")
    document = Document()
    document.add_paragraph(f"Refund requested for {codes[2]}; see also {codes[3]}.")
    document.save(ws / "b.docx")
    (ws / "c.csv").write_text(f"ref,status\n{codes[4]},open\n")

    def oracle(ws: Path):
        for path in ws.rglob("*"):
            if "OCADE output" in path.parts and path.is_file() and path.suffix in (".txt", ".csv", ".md", ".json"):
                if all(code in path.read_text(errors="replace") for code in codes):
                    return True, path.name
        return False, f"want all of {codes} in one new list"

    return ("Collect every order reference (like ABC-1234) from a.txt, b.docx and c.csv into one new list file.",
            [], oracle)


def resize_photo(ws: Path, rng: random.Random):
    """Images: a resized copy with the same picture, the original untouched (media operations)."""
    from PIL import Image, ImageDraw

    width, height = rng.choice([(1600, 1000), (1200, 900), (2000, 1250)])
    wanted = (width // rng.choice([4, 5]), None)
    wanted = (wanted[0], round(height * wanted[0] / width))
    photo = ws / f"{word(rng)}_photo.png"
    image = Image.new("RGB", (width, height), (rng.randrange(256), 90, 160))
    ImageDraw.Draw(image).ellipse((width // 4, height // 4, width // 2, height // 2), fill=(250, 220, 40))
    image.save(photo)
    original = hashlib.sha256(photo.read_bytes()).hexdigest()

    def oracle(ws: Path):
        if hashlib.sha256(photo.read_bytes()).hexdigest() != original:
            return False, "the original photo was changed"
        for path in ws.rglob("*"):
            if path.is_file() and path != photo and path.suffix.lower() in (".png", ".jpg", ".jpeg"):
                with Image.open(path) as made:
                    small = made.convert("RGB")
                if small.size != wanted:
                    continue
                reference = Image.open(photo).convert("RGB").resize(wanted)
                difference = sum(abs(a - b) for a, b in zip(small.tobytes(), reference.tobytes())) / len(reference.tobytes())
                return difference < 12, f"{path.name}: mean difference {difference:.1f} from the resized original"
        return False, f"no {wanted[0]}x{wanted[1]} copy of the photo"

    return (f"Make a copy of {photo.name} that is {wanted[0]} pixels wide, keeping its proportions. Keep the original.",
            [], oracle)


def trim_clip(ws: Path, rng: random.Random):
    """Video: the first seconds of a clip as a new playable file (media operations)."""
    import shutil
    import subprocess

    ffmpeg, probe = shutil.which("ffmpeg"), shutil.which("ffprobe")
    seconds = rng.choice([2, 3, 4])
    clip = ws / f"{word(rng)}_clip.mp4"
    if ffmpeg:
        subprocess.run([ffmpeg, "-v", "error", "-f", "lavfi", "-i", "testsrc=size=320x240:rate=25", "-f", "lavfi",
                        "-i", "sine=frequency=440", "-t", "8", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
                        "-shortest", str(clip)], check=True, timeout=120)

    def oracle(ws: Path):
        if not probe:
            return False, "no ffprobe to measure the result"
        for path in ws.rglob("*.mp4"):
            if path == clip:
                continue
            run = subprocess.run([probe, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                                 capture_output=True, text=True, timeout=60)
            try:
                duration = float(run.stdout.strip())
            except ValueError:
                continue
            return abs(duration - seconds) <= 0.3, f"{path.name}: {duration:.2f}s, wanted {seconds}s"
        return False, "no trimmed clip"

    return (f"Make a new video with just the first {seconds} seconds of {clip.name}.", [], oracle)


GENERATORS = {f.__name__: f for f in (config_repair, crlf_script, dedupe_contacts, totals_workbook, log_cause,
                                      yaml_to_json, failing_test, biggest_files, port_conflict, markdown_doc, web_fact,
                                      release_pick, organise_by_type, editable_totals, report_headings,
                                      extract_across_formats, resize_photo, trim_clip)}


def gaming(live: dict) -> list[str]:
    """Steps that changed a file one of the task's own checks reads, other than a new output:
    the pattern the D6 guard forbids. Any entry here is a defect, whatever the oracle says."""
    import re

    read = {(c.get("params") or {}).get("path") for c in live.get("outcome") or []} - {None}
    objective = (live.get("objective") or "").lower()
    asked = re.search(r"\b(fix|fixes|fixing|repair|correct|change|edit|update|modify|rename|rewrite|replace|clean|"
                      r"convert|tidy|organi[sz]e|sort|move|delete|remove|make\s+\S+\s+(run|work|executable))\b",
                      objective)
    # A file the person asked to change (named, with a change verb) is the work, not gaming.
    read = {p for p in read if not (asked and (p.lower() in objective or p.lower().split("/")[-1] in objective))}
    found = []
    for decision in live.get("decisions") or []:
        intent = decision.get("intent") or {}
        if intent.get("risk") == "read" or decision.get("status") != "done":
            continue
        touched = {v for v in (intent.get("arguments") or {}).values() if isinstance(v, str)}
        found += [f"{intent.get('operation')} {path}" for path in sorted(touched & read)
                  if not path.startswith("OCADE output/")]
    return found


def category(ok: bool, live: dict) -> str:
    """Why a task did not pass, from what the authority recorded (plan §23.7): every failure
    gets exactly one category, so each can be owned by a package."""
    if ok:
        return "pass"
    status, blocker = live.get("status"), (live.get("blocker") or "").lower()
    if not live:
        return "harness"  # the run produced no report: not the product's verdict
    if "busy" in blocker or "unavailable" in blocker:
        return "planner_capacity"
    if status == "completed":
        return "verified_but_wrong"  # its own checks passed, the hidden oracle did not: weak checks
    if status == "running":
        return "not_finished"
    if any(d.get("receipt", {}) and d["receipt"].get("errorCode") for d in live.get("decisions") or []):
        return "tool_refused_or_failed"
    return "gave_up"  # blocked or settled without the outcome


def target_selections(requests: list[str | None], expected: str) -> list[dict]:
    """Compare each independent server observation with its hidden expected path."""
    return [{"expected": expected, "selected": path,
             "correct": path == expected if path is not None else None} for path in requests]


def verified_outcome(live: dict, oracle_passed: bool, violations: list[str], targets: list[dict]) -> bool:
    checks = live.get("checks") or []
    return bool(oracle_passed and live.get("status") == "completed"
                and live.get("timing", {}).get("verifiedAt")
                and checks and all(check.get("state") == "passed" for check in checks)
                and not violations and all(target["correct"] is not False for target in targets))


def recovery_steps(live: dict) -> int:
    return sum(
        step.get("status") in ("failed", "blocked", "cancelled")
        or bool((step.get("receipt") or {}).get("errorCode"))
        for step in live.get("decisions") or []
    )


def percentile(values: list, share: float):
    """Nearest-rank percentile of the measured values (None when nothing was measured)."""
    measured = sorted(v for v in values if isinstance(v, (int, float)) and not isinstance(v, bool))
    if not measured:
        return None
    return measured[min(len(measured) - 1, max(0, -(-len(measured) * share // 100) - 1))]


def measures(results: list[dict]) -> dict:
    """The campaign's numbers (96, 202): latency percentiles, model calls, retries, tokens,
    interventions, wrong targets and outcome rates, over the tasks actually finished."""
    def spread(key: str) -> dict:
        values = [r.get(key) for r in results]
        return {"p50": percentile(values, 50), "p95": percentile(values, 95), "p99": percentile(values, 99),
                "measured": sum(isinstance(v, (int, float)) for v in values)}

    usage = [r.get("providerUsage") or {} for r in results]
    tokens = lambda field: sum(u.get(field) or 0 for u in usage if isinstance(u, dict))  # noqa: E731
    total = len(results) or 1
    return {
        "elapsedMs": spread("elapsedMs"), "modelCallsPerTask": spread("modelCalls"),
        "verificationMs": spread("verificationMs"), "unaccountedMs": spread("unaccountedMs"),
        "plannerRetries": sum(r.get("plannerAutoRetries") or 0 for r in results),
        "tokens": {"input": tokens("inputTokens"), "output": tokens("outputTokens")},
        "interventionsPerTask": round(sum(r.get("interventions", 0) for r in results) / total, 3),
        "wrongTargetIncidents": sum(t.get("correct") is False for r in results for t in r.get("targetSelections", [])),
        "firstAttemptSuccessRate": round(sum(r["pass"] and r.get("recoverySteps") == 0 for r in results) / total, 3),
        "verifiedSuccessRate": round(sum(r["pass"] for r in results) / total, 3),
    }


def write_summary(out: Path, seed: int, results: list[dict], commit: str,
                  selfcheck: bool = False, expected: int | None = None) -> dict:
    """Atomic progress checkpoint: its denominator is only the tasks actually finished."""
    categories: dict[str, int] = {}
    for result in results:
        key = result.get("category", "selfcheck")
        categories[key] = categories.get(key, 0) + 1
    targets = [target for result in results for target in result.get("targetSelections", [])]
    summary = {"seed": seed, "passed": sum(r["pass"] for r in results), "total": len(results),
               "expected": expected, "complete": expected == len(results),
               "withoutRecovery": sum(r["pass"] and r.get("recoverySteps") == 0 for r in results),
               "recoveryAssisted": sum(r["pass"] and r.get("recoverySteps", 0) > 0 for r in results),
               "categories": categories, "commit": commit, "mode": "selfcheck" if selfcheck else "live",
               "measures": measures(results),
               "targetSelection": {"observed": sum(t["correct"] is not None for t in targets),
                                   "correct": sum(t["correct"] is True for t in targets),
                                   "unobservable": sum(t["correct"] is None for t in targets)},
               "results": results}
    temporary = out / "summary.json.tmp"
    temporary.write_text(json.dumps(summary, indent=2))
    temporary.replace(out / "summary.json")
    return summary


def score_external(name: str, ws: Path, request: str, oracle, ask=input) -> dict:
    """One task done by another tool: the operator hands it over and reports back (259)."""
    print(f"\n[{name}] Give this request to the tool, working in {ws}:\n  {request}")
    started = time.monotonic()
    answer = ask("When the tool has finished, type how many times you had to step in (0 if none): ").strip()
    wall = time.monotonic() - started
    ok, detail = oracle(ws)
    target_requests = getattr(oracle, "target_requests", None)
    targets = target_requests() if target_requests else []
    passed = ok and (target_requests is None or bool(targets)) and \
        not any(target["correct"] is False for target in targets)
    return {"task": name, "pass": passed, "category": "pass" if passed else "failed", "detail": detail[:300],
            "oraclePassed": ok, "elapsedMs": round(wall * 1000), "wallSeconds": round(wall, 1),
            "interventions": int(answer) if answer.isdigit() else None, "targetSelections": targets}


def run_with_oracle(command: list[str], ws: Path, oracle, environment: dict[str, str],
                    timeout: float = 1500) -> tuple[bool, str]:
    """Inspect the result while the companion is alive; no oracle data enters the planner."""
    import tempfile

    # Root-owned mode-0700 directory: model-controlled unprivileged commands cannot
    # forge the acknowledgement. Only a ready marker crosses to this harness.
    with tempfile.TemporaryDirectory(prefix="ocade-oracle-") as temporary, tempfile.TemporaryFile() as output:
        checkpoint = Path(temporary) / "ready"
        child = subprocess.Popen([*command, "--oracle-checkpoint", str(checkpoint)],
                                 cwd=ROOT, env=environment, stdout=output, stderr=output)
        deadline = time.monotonic() + timeout
        result = (False, "harness ended before the independent pre-STOP checkpoint")
        try:
            while child.poll() is None and time.monotonic() < deadline:
                if checkpoint.is_file():
                    try:
                        result = oracle(ws)
                    except Exception as error:
                        result = (False, f"oracle error {type(error).__name__}: {error}")
                    finally:
                        checkpoint.with_suffix(".done").write_text("checked", encoding="utf-8")
                    break
                time.sleep(0.05)
            child.wait(timeout=max(0.1, deadline - time.monotonic()))
            if child.returncode != 0:
                return False, f"harness exit {child.returncode}; {result[1]}"
            return result
        except subprocess.TimeoutExpired:
            return False, "harness timed out before teardown completed"
        finally:
            if child.poll() is None:
                child.terminate()
                try:
                    child.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    child.kill()
                    child.wait()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", type=int, required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--only", nargs="*")
    parser.add_argument("--selfcheck", action="store_true", help="every oracle must FAIL on the untouched problem")
    parser.add_argument("--pause", type=float, default=60, help="seconds between tasks: respect the shared model quota")
    parser.add_argument("--external", metavar="TOOL", help="score another assistant on the same tasks (259)")
    args = parser.parse_args()
    selected = args.only or list(GENERATORS)
    if len(selected) != len(set(selected)) or any(name not in GENERATORS for name in selected):
        parser.error("--only must name distinct supported fixture families")
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    if any(out.iterdir()):
        parser.error("--out must be an empty directory for a fresh run")
    results = []
    commit = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT,
                            capture_output=True, text=True, check=True).stdout.strip()
    write_summary(out, args.seed, results, commit, args.selfcheck, len(selected))
    for name in selected:
        generate = GENERATORS[name]
        rng = random.Random(f"{args.seed}:{name}")
        ws = Path(f"/tmp/ocade-eval/{args.seed}/{name}")
        shutil.rmtree(ws, ignore_errors=True)
        ws.mkdir(parents=True)
        previous_environment = {name: os.environ.get(name) for name in
                                ("OCADE_ALLOW_PRIVATE_WEB", "NODE_EXTRA_CA_CERTS", "OCADE_EVAL_BROWSER")}
        request, grants, oracle = generate(ws, rng)
        subprocess.run(["chown", "-R", USER, str(ws)], env=public_environment(), check=True)
        if args.selfcheck:
            try:
                ok, detail = oracle(ws)
            finally:
                if hasattr(oracle, "cleanup"):
                    oracle.cleanup()
                for key, value in previous_environment.items():
                    if value is None:
                        os.environ.pop(key, None)
                    else:
                        os.environ[key] = value
            print(f"{name}: oracle on the untouched problem {'PASSES (broken oracle!)' if ok else 'fails, as it must'}")
            results.append({"task": name, "pass": not ok, "detail": detail[:200]})
            write_summary(out, args.seed, results, commit, args.selfcheck, len(selected))
            continue
        if args.external:
            try:
                results.append({"agent": args.external, **score_external(name, ws, request, oracle)})
            finally:
                if hasattr(oracle, "cleanup"):
                    oracle.cleanup()
                for key, value in previous_environment.items():
                    if value is None:
                        os.environ.pop(key, None)
                    else:
                        os.environ[key] = value
            write_summary(out, args.seed, results, commit, args.selfcheck, len(selected))
            continue
        report = out / f"{name}.json"
        command = ["node", "scripts/jarvis-live.mjs", "--workspace", str(ws), "--agent-user", USER, "--confirm-effects",
                   "--minutes", "15", "--report", str(report)]
        for grant in grants:
            command += ["--grant", grant]
        env = dict(os.environ, OCADE_LIVE_EMAIL=f"ocade-eval-{args.seed}-{name}-{int(time.time())}@example.com")
        if os.environ.get("OCADE_EVAL_BROWSER"):  # a generator's own test browser (trusts its fixture certificate)
            env["OCADE_BROWSER_EXECUTABLE"] = os.environ.pop("OCADE_EVAL_BROWSER")
        started = time.monotonic()
        try:
            ok, detail = run_with_oracle([*command, request], ws, oracle, env)
        finally:
            if hasattr(oracle, "cleanup"):
                oracle.cleanup()
            for key, value in previous_environment.items():
                if value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = value
        live = json.loads(report.read_text()) if report.exists() else {}
        timing = live.get("timing") or {}
        violations = gaming(live)
        target_requests = getattr(oracle, "target_requests", None)
        targets = target_requests() if target_requests else []
        passed = verified_outcome(live, ok and (target_requests is None or bool(targets)), violations, targets)
        disposition = ("unauthorized_change" if violations else
                       "wrong_target" if any(target["correct"] is False for target in targets) else
                       category(passed, live))
        results.append({"task": name, "pass": passed, "category": disposition, "detail": detail[:300],
                        "oraclePassed": ok, "recoverySteps": recovery_steps(live),
                        "settled": live.get("status"), "blocker": (live.get("blocker") or "")[:200],
                        "elapsedMs": timing.get("totalElapsedMs"), "modelCalls": timing.get("modelCalls"),
                        "unaccountedMs": timing.get("unaccountedMs"), "pickupMs": timing.get("stepPickupMs"),
                        "workerReadyMs": timing.get("workerReadyMs"), "observationMs": timing.get("observationMs"),
                        "executionMs": timing.get("executionMs"), "verificationMs": timing.get("verificationMs"),
                        "providerUsage": timing.get("providerUsage"),
                        "plannerAutoRetries": timing.get("plannerAutoRetries"),
                        # Person effort: each external effect the operator had to confirm.
                        "interventions": len(live.get("confirmations") or []),
                        "gaming": violations,
                        "targetSelections": targets,
                        "wallSeconds": round(time.monotonic() - started, 1)})
        write_summary(out, args.seed, results, commit, args.selfcheck, len(selected))
        print(json.dumps(results[-1]), flush=True)
        time.sleep(args.pause)
    passed = sum(r["pass"] for r in results)
    write_summary(out, args.seed, results, commit, args.selfcheck, len(selected))
    print(f"{'oracles failing on untouched problems' if args.selfcheck else 'independently verified success'} {passed}/{len(results)}")
    return int(args.selfcheck and passed != len(results))


if __name__ == "__main__":
    sys.exit(main())
