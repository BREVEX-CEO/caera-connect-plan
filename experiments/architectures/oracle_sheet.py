"""
Independent check of the phone comparison sheet: reads the EtherCalc sheet itself, never the run's claims.

python3 oracle_sheet.py <run.json>
The link must be in the answer. Facts are checked against the two Wikipedia infoboxes as read
on 21 Oct 2026 (base models); each numeric difference must be a formula and show its value.
"""
import csv
import io
import json
import re
import sys
import urllib.request

TRUTH = {  # fact: (Samsung Galaxy S25, iPhone 16), from the infoboxes
    "display": (6.2, 6.1), "weight": (162, 170), "battery": (4000, 3561), "storage": (128, 128)}
DATES = (("2025", "feb"), ("2024", "sep"))

run = json.load(open(sys.argv[1]))
answer = str(run.get("outcome", {}).get("answer", ""))
link = re.search(r"https?://ethercalc\.net/(?:#?)([A-Za-z0-9_-]{4,})", answer)
result: dict = {"link": link.group(0) if link else None}
if not link:
    print(json.dumps({**result, "pass": False}))
    sys.exit()
sheet = link.group(1)


def get(path: str) -> str:
    request = urllib.request.Request(f"https://ethercalc.net{path}", headers={"User-Agent": "ocade-oracle"})
    return urllib.request.urlopen(request, timeout=30).read().decode()


rows = list(csv.reader(io.StringIO(get(f"/_/{sheet}/csv"))))
save = get(f"/_/{sheet}")
# SocialCalc's save format: a formula cell is "cell:D3:vtf:n:-8:B3-C3".
formulas = dict(re.findall(r"^cell:([A-Z]+\d+):vtf:[^:]*:[^:]*:([^:\n]+)", save, re.M))


def number(text: str):
    found = re.search(r"-?\d+(?:\.\d+)?", text.replace(",", ""))
    return float(found.group()) if found else None


checks = {}
for fact, (samsung, iphone) in TRUTH.items():
    row = next((r for r in rows if r and fact in r[0].lower()), None)
    values = [number(c) for c in row[1:]] if row else []
    checks[fact] = {
        "row": row,
        "facts": bool(row) and samsung in values and iphone in values,
        "difference": bool(row) and round(samsung - iphone, 2) in [round(v, 2) for v in values if v is not None],
    }
date_row = next((r for r in rows if r and ("release" in r[0].lower() or "date" in r[0].lower())), None)
text = " ".join(date_row).lower() if date_row else ""
checks["release"] = {"row": date_row, "facts": all(y in text and m in text for y, m in DATES)
                     or ("2025-02-07" in text and "2024-09-20" in text),
                     # each phone's whole date in its own column, not split across cells
                     "inTheirCells": bool(date_row) and len(date_row) > 2 and "2025" in date_row[1]
                     and "2024" in date_row[2]}
result.update(rows=len(rows), formulas=len(formulas), checks=checks)
result["pass"] = all(c["facts"] for c in checks.values()) and checks["release"]["inTheirCells"] and all(
    checks[f]["difference"] for f in TRUTH) and len(formulas) >= 3
print(json.dumps(result))
