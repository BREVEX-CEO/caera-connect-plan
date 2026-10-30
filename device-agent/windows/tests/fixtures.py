"""Deterministic input workbooks for tests. Fixtures may simulate inputs, never agent output."""

from pathlib import Path

import openpyxl


def ledger_workbook(path: Path) -> dict:
    """Ledger vs Bank: 5 keys, one amount mismatch, one missing on each side."""
    book = openpyxl.Workbook()
    ledger = book.active
    ledger.title = "Ledger"
    ledger.append(["Invoice ID", "Customer", "Amount"])
    for row in [("INV-1", "Acme", 100.0), ("INV-2", "Beta", 250.5), ("INV-3", "Cora", 75.25), ("INV-4", "Dune", 10.0)]:
        ledger.append(row)
    bank = book.create_sheet("Bank")
    bank.append(["Reference", "Amount"])
    for row in [("INV-1", 100.0), ("INV-2", 250.0), ("INV-3", 75.25), ("INV-5", 42.0)]:
        bank.append(row)
    path.parent.mkdir(parents=True, exist_ok=True)
    book.save(path)
    return {
        "left": {"sheet": "Ledger", "key": "Invoice ID", "amount": "Amount"},
        "right": {"sheet": "Bank", "key": "Reference", "amount": "Amount"},
        "rows": 5,
        "exceptions": 3,
    }
