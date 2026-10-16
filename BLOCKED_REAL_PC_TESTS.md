# Deferred real-PC tests

These tests genuinely cannot be completed in an available cloud environment. The owner's instruction of 16 October 2026 suspends all testing on the owner's PC until the owner gives separate approval. Each test is held here until then. Cloud-testable work never belongs in this file. [PLAN.md](PLAN.md) keeps the phase records; this file lists only what still needs a real PC.

Common safety rules for every entry:

- Run only with the owner present and approving that session.
- Use a separate Windows user account, or at least a desktop where Notepad, Word and Excel are closed.
- Use disposable test folders only; never a personal file, account or open document.
- Before the run, list the open windows. Stop at once if any app the test uses is already open.

---

## PC-02-01 — Windows 11 tabbed Notepad: JARVIS writes only into the document it opened

- **Phase / test ID:** Phase 02 (final-effect authority, target identity) · `test_computer.NativeAppTest.test_notepad_written_saved_through_its_dialog_and_read_back` plus the Notepad incident regression.
- **Functionality:** opening an app that reuses a window that is already open (Windows 11 Notepad opens a new tab in the existing window); targeting that tab by its exact title; refusing an ambiguous title; refusing a write after the window shows another document (tab switch); asking before replacing a document's existing text.
- **Why the cloud cannot substitute:** GitHub's Windows runners are Windows Server, which ships the classic, untabbed Notepad and no Microsoft Store apps. The tab-merging behaviour that caused the 16 October incident exists only on Windows 11 client editions. The cloud covers the logic with strict UI Automation fixtures (`test_ui_act.py`), but not the real tabbed app.
- **Files / functions:** `jarvis-runtime/ocade_accessibility.py` (`_pick`, `_window`, `_same_document`, `act`), `jarvis-runtime/ocade_computer.py` (`_open_app`, `_window`), `jarvis-runtime/tests/test_computer.py` (`NativeAppTest`), `jarvis-runtime/tests/test_ui_act.py`.
- **Risks and precautions:** this test once replaced the text of the owner's unsaved Notepad tab. Run it only in a separate Windows user account, or after confirming no Notepad window exists; the test now skips itself if one does. Create a second, disposable Notepad tab with sample text before the run, to prove it stays untouched.
- **Procedure and expected result:**
  1. In a disposable Windows 11 account, open Notepad with one tab containing the sample text "KEEP ME".
  2. Close it, then run the live test with `OCADE_LIVE_TESTS=1`. Expected: it skips while Notepad is open, and runs once Notepad is closed.
  3. Reopen Notepad with the "KEEP ME" tab. Use OCADE's `open_app` "Notepad". Expected: the result names the new tab's exact window title.
  4. Try `ui_inspect` with the title "Notepad". Expected: refused, "Several windows match" (if two windows) or bound to the exact title.
  5. Read the new tab, switch to the "KEEP ME" tab by hand, then try `set_value` with the earlier observation. Expected: `stale`, "now shows another document".
  6. Try `set_value` on a tab that has text, without confirmation. Expected: `needs_confirmation`.
  7. Check the "KEEP ME" tab afterwards. Expected: unchanged.
- **Status:** BLOCKED — REAL PC TEST DEFERRED.

## PC-07-01 — Licensed Microsoft Excel and Word: finish, save, reopen and verify a real workbook and document

- **Phase / test ID:** Phase 07 (native file and Office fidelity) · `test_sheets.RealSpreadsheetAppTest.test_finish_the_orders_sheet_in_excel`, `test_files_documents.DeckTest`, Office routes of `office-journey.mjs`.
- **Functionality:** JARVIS driving the person's own licensed Excel and Word through their automation interfaces: formulas calculated by Excel itself, formatting, Save As, reopen, and independent verification of the saved file.
- **Why the cloud cannot substitute:** cloud Windows runners have no licensed Microsoft Office, and activating Office in a disposable VM is not permitted at ₹0. ONLYOFFICE/LibreOffice in the cloud cover file-format fidelity only. They do not cover the licensed Office automation path customers will use. A single PC run on 16 October 2026 passed `test_finish_the_orders_sheet_in_excel`; it must be repeated on the final candidate.
- **Files / functions:** `jarvis-runtime/ocade_sheets.py` (`edit`, `automation_server`), `jarvis-runtime/actions/ocade_workbook.ps1`, `jarvis-runtime/actions/ocade_document.ps1`, `jarvis-runtime/ocade_documents.py`.
- **Risks and precautions:** Excel and Word may already have the owner's files open. Run only with both apps closed, in a disposable folder, and never on an existing workbook or document. The test opens visible windows, so do not use the PC during it.
- **Procedure and expected result:**
  1. Close Excel and Word.
  2. Run the live Office tests with `OCADE_LIVE_TESTS=1` against a temporary workspace.
  3. Expected: the totals are calculated by Excel and kept as formulas; formatting and the other sheets are preserved; the original file is untouched; the copy reopens with the same values.
  4. Then run the office journey on the final candidate. Expected: every check passes, with the report's words read back from the saved `.docx`.
- **Status:** BLOCKED — REAL PC TEST DEFERRED.
