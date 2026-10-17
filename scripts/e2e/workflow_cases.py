"""Held-out cases for the three recurring workflows (PLAN Phase 18), and their independent checks.

  python workflow_cases.py make  <workflow> <seed> <work folder> <site folder> <today>
  python workflow_cases.py check <workflow> <seed> <work folder> <site folder> <today>

`make` writes one case's inputs (seeded, so a case is the same every run) and prints the
request a person would type; `check` prints which outcome predicates hold. The checks never
use JARVIS's words: totals are recalculated by LibreOffice, documents and PDFs are read here,
and the originals must be byte-identical. Synthetic data only.
"""
import datetime
import hashlib
import json
import random
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

CLIENTS = ["Acme Traders", "Sharma & Sons", "Blue Lotus Studio", "Kaveri Foods", "Nilgiri Tea Co",
           "Patel Hardware", "Monsoon Media", "Deccan Logistics"]
STATUSES = ["Shipped", "Packed", "Delivered", "On hold", "Awaiting payment"]
ORIGINALS = {"reconcile": ["ledger.xlsx", "bank.csv"], "pack": ["template.docx", "client.xlsx"],
             "status": []}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def reconcile_case(seed: int) -> dict:
    rng = random.Random(seed)
    ledger = [{"id": f"INV-{1000 + seed * 20 + i}", "client": rng.choice(CLIENTS),
               "amount": rng.randint(100, 5000) + rng.choice([0, 0.5, 0.25])}
              for i in range(rng.randint(8, 14))]
    missing, mismatch = rng.sample(range(len(ledger)), 2)
    bank = [{"id": row["id"], "amount": row["amount"]} for i, row in enumerate(ledger) if i != missing]
    for row in bank:
        if row["id"] == ledger[mismatch]["id"]:
            row["amount"] = round(row["amount"] + rng.randint(1, 50), 2)
    extra = {"id": f"INV-{1000 + seed * 20 + 19}", "amount": float(rng.randint(100, 900))}
    bank.append(extra)
    rng.shuffle(bank)
    unmatched = {ledger[missing]["id"], ledger[mismatch]["id"], extra["id"]}
    matched = [row for row in ledger if row["id"] not in unmatched]
    return {"ledger": ledger, "bank": bank, "unmatched": sorted(unmatched),
            "matched": sorted(row["id"] for row in matched),
            "total": round(sum(row["amount"] for row in matched), 2)}


def pack_case(seed: int) -> dict:
    rng = random.Random(seed)
    return {"Client": rng.choice(CLIENTS), "Invoice": f"INV-{2000 + seed}",
            "Amount": f"{rng.randint(1000, 90000):,}.00",
            "Due": f"{rng.randint(1, 28)} {rng.choice(['November', 'December'])} 2026"}


def status_case(seed: int, today: datetime.date) -> dict:
    rng = random.Random(seed)
    orders = [f"A{seed}{i:02d}" for i in range(1, 5)]
    stale, missing = rng.sample(orders, 2)
    pages = {}
    for order in orders:
        if order == missing:
            continue
        age = rng.randint(9, 30) if order == stale else rng.randint(0, 3)
        when = today - datetime.timedelta(days=age)
        pages[order] = {"status": rng.choice(STATUSES), "updated": f"{when.isoformat()} {rng.randint(8, 18):02d}:30"}
    return {"orders": orders, "pages": pages, "problems": sorted([stale, missing]), "missing": missing}


def make(workflow: str, seed: int, work: Path, site: Path, today: datetime.date, base: str) -> str:
    from openpyxl import Workbook
    if workflow == "reconcile":
        case = reconcile_case(seed)
        book = Workbook()
        sheet = book.active
        sheet.title = "Ledger"
        sheet.append(["ID", "Client", "Amount"])
        for row in case["ledger"]:
            sheet.append([row["id"], row["client"], row["amount"]])
        book.save(work / "ledger.xlsx")
        (work / "bank.csv").write_text("Reference,Amount\n" + "".join(
            f"{row['id']},{row['amount']:.2f}\n" for row in case["bank"]))
        return ("Reconcile ledger.xlsx against bank.csv in my work folder (the bank's Reference is the "
                "ledger's ID). Make a new workbook reconciliation.xlsx with a sheet named Matched listing "
                "every record whose ID and amount agree in both files, with a total row that uses a SUM "
                "formula, and a sheet named Unmatched listing every ID that is missing from either file or "
                "whose amounts differ, with the ledger and bank amounts. Leave ledger.xlsx and bank.csv "
                "unchanged.")
    if workflow == "pack":
        from docx import Document
        case = pack_case(seed)
        book = Workbook()
        book.active.append(["Field", "Value"])
        for field, value in case.items():
            book.active.append([field, value])
        book.save(work / "client.xlsx")
        doc = Document()
        doc.add_paragraph("Invoice pack for {{Client}}", style="Title")
        doc.add_paragraph("Summary", style="Heading 1")
        doc.add_paragraph("Invoice {{Invoice}} for {{Client}}: amount due {{Amount}} by {{Due}}.")
        table = doc.add_table(rows=0, cols=2)
        for field in case:
            cells = table.add_row().cells
            cells[0].text, cells[1].text = field, "{{" + field + "}}"
        doc.add_paragraph("Prepared for review; not sent.", style="Quote")
        doc.save(work / "template.docx")
        return ("Fill template.docx with the details in client.xlsx (both in my work folder): save the "
                "filled document as pack.docx with every {{placeholder}} replaced and the template's "
                "formatting kept, then save pack.docx as pack.pdf. Do not send it to anyone.")
    case = status_case(seed, today)
    shutil.rmtree(site, ignore_errors=True)
    site.mkdir(parents=True)
    for order, page in case["pages"].items():
        (site / f"{order}.html").write_text(
            f"<!doctype html><title>Order {order}</title><h1>Order {order}</h1>"
            f"<p>Status: <b>{page['status']}</b></p><p>Updated: {page['updated']}</p>")
    urls = ", ".join(f"{base}/{order}.html" for order in case["orders"])
    return (f"Check these order status pages: {urls}. Make status.xlsx in my work folder with the "
            "columns Order, Status, Updated and Source for every order, and a sheet named Problems "
            f"listing each order whose page is missing or was updated more than 7 days before today "
            f"({today.isoformat()}). Don't fill in anything a page doesn't say.")


def recalculated(path: Path) -> Path:
    """The workbook as LibreOffice calculates it: another engine's values, saved as a copy."""
    out = Path(tempfile.mkdtemp())
    subprocess.run(["soffice", f"-env:UserInstallation={(out / 'profile').as_uri()}", "--headless",
                    "--convert-to", "xlsx", "--outdir", str(out), str(path)], check=True,
                   capture_output=True, timeout=120)
    return out / path.name


def sheet_rows(path: Path, name: str, values: bool = True) -> list[list] | None:
    from openpyxl import load_workbook
    book = load_workbook(path, data_only=values)
    found = next((s for s in book.worksheets if s.title.strip().lower() == name.lower()), None)
    return None if found is None else [list(r) for r in found.iter_rows(values_only=True)]


def ids_in(rows: list[list], pattern: str) -> set[str]:
    return {str(v).strip() for row in rows for v in row if v is not None and re.fullmatch(pattern, str(v).strip())}


def check(workflow: str, seed: int, work: Path, site: Path, today: datetime.date, digests: dict) -> list:
    results = [(f"{name} is unchanged", (work / name).is_file() and digest(work / name) == digests[name], "")
               for name in ORIGINALS[workflow]]
    if workflow == "reconcile":
        case = reconcile_case(seed)
        out = work / "reconciliation.xlsx"
        if not out.is_file():
            return results + [("reconciliation.xlsx exists", False, "")]
        formulas = sheet_rows(out, "Matched", values=False) or []
        matched = sheet_rows(recalculated(out), "Matched")
        unmatched = sheet_rows(out, "Unmatched")
        results.append(("Matched lists exactly the agreeing records",
                        matched is not None and ids_in(matched, r"INV-\d+") == set(case["matched"]),
                        str(sorted(ids_in(matched or [], r"INV-\d+")))))
        totals = [v for row in matched or [] if any("total" in str(c).lower() for c in row)
                  for v in row if isinstance(v, (int, float))]
        results.append(("its total, recalculated by LibreOffice, is the true total",
                        any(abs(v - case["total"]) < 0.005 for v in totals), f"{totals} vs {case['total']}"))
        results.append(("the total is a SUM formula",
                        any(str(v).upper().startswith("=SUM(") for row in formulas for v in row), ""))
        results.append(("Unmatched lists exactly the missing and differing IDs",
                        unmatched is not None and ids_in(unmatched, r"INV-\d+") == set(case["unmatched"]),
                        f"{sorted(ids_in(unmatched or [], r'INV-[0-9]+'))} vs {case['unmatched']}"))
        return results
    if workflow == "pack":
        from docx import Document
        from pypdf import PdfReader
        case = pack_case(seed)
        out, pdf = work / "pack.docx", work / "pack.pdf"
        if not out.is_file():
            return results + [("pack.docx exists", False, "")]
        filled, template = Document(str(out)), Document(str(work / "template.docx"))
        text = "\n".join([p.text for p in filled.paragraphs] +
                         [c.text for t in filled.tables for r in t.rows for c in r.cells])
        results.append(("no placeholder is left", "{{" not in text and "}}" not in text, ""))
        results.append(("every detail is filled in", all(v in text for v in case.values()),
                        str([v for v in case.values() if v not in text])))
        results.append(("the template's styles are kept",
                        [p.style.name for p in filled.paragraphs if p.text.strip()]
                        == [p.style.name for p in template.paragraphs if p.text.strip()], ""))
        pdf_text = " ".join(page.extract_text() or "" for page in PdfReader(str(pdf)).pages) \
            if pdf.is_file() else ""
        results.append(("pack.pdf carries the filled details",
                        bool(pdf_text) and all(v in re.sub(r"\s+", " ", pdf_text) for v in case.values()),
                        "no pdf" if not pdf_text else ""))
        return results
    case = status_case(seed, today)
    out = work / "status.xlsx"
    if not out.is_file():
        return results + [("status.xlsx exists", False, "")]
    rows = sheet_rows(out, sheet_rows_name(out)) or []
    problems = sheet_rows(out, "Problems")
    order_id = r"A\d+"
    for order, page in case["pages"].items():
        row = next((r for r in rows if any(str(v).strip() == order for v in r)), None)
        cells = " | ".join("" if v is None else str(v) for v in row or [])
        results.append((f"{order}: its status and update time, as its page says",
                        row is not None and page["status"] in cells and page["updated"][:10] in cells, cells))
    gone = next((r for r in rows if any(str(v).strip() == case["missing"] for v in r)), [])
    results.append(("nothing is invented for the missing page",
                    not any(s.lower() in " ".join(str(v).lower() for v in gone) for s in STATUSES),
                    str(gone)))
    results.append(("Problems lists exactly the missing and stale orders",
                    problems is not None and ids_in(problems, order_id) == set(case["problems"]),
                    f"{sorted(ids_in(problems or [], order_id))} vs {case['problems']}"))
    return results


def sheet_rows_name(path: Path) -> str:
    """The status sheet is whichever sheet is not Problems."""
    from openpyxl import load_workbook
    return next(s.title for s in load_workbook(path).worksheets if s.title.lower() != "problems")


if __name__ == "__main__":
    command, workflow, seed, work, site, today = sys.argv[1:7]
    work, site, seed = Path(work), Path(site), int(seed)
    day = datetime.date.fromisoformat(today)
    manifest = site.parent / f"{workflow}-{seed}.json"
    if command == "make":
        request = make(workflow, seed, work, site, day, sys.argv[7] if len(sys.argv) > 7 else "")
        manifest.write_text(json.dumps({n: digest(work / n) for n in ORIGINALS[workflow]}))
        print(json.dumps({"request": request}))
    else:
        found = check(workflow, seed, work, site, day, json.loads(manifest.read_text()))
        print(json.dumps([{"name": n, "ok": bool(ok), "detail": d[:300]} for n, ok, d in found]))
