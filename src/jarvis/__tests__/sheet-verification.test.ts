import { describe, expect, it } from "vitest";
import { verificationGap, type ActionRow } from "../task-authority.server";
import type { OutcomeCheck } from "../protocol";

function workbook(
  name: string,
  value: unknown = 2,
  names: string[] = [name],
  coordinate = "B2",
) {
  return {
    sheet: name,
    sheets: names.map((name) => ({ name, filledRows: 2 })),
    cells: [[{ cell: coordinate, value }]],
  };
}

function row(book: unknown): ActionRow {
  return {
    status: "done",
    action: { action: "sheet_inspect", path: "orders.xlsx" },
    result: { detail: { workbook: book } },
  };
}

function mediaRow(currentTime: unknown, paused: unknown = true): ActionRow {
  return {
    status: "done",
    action: { action: "media", op: "state" },
    result: { detail: { media: { currentTime, paused } } },
  };
}

function infoRow(properties: unknown): ActionRow {
  return {
    status: "done",
    action: { action: "file_info", path: "report.pdf" },
    result: { detail: { info: { size: 10, properties } } },
  };
}

function wordsRow(bodyWords: unknown): ActionRow {
  return {
    status: "done",
    action: { action: "file_extract", path: "report.docx" },
    result: { detail: { bodyWords, content: "one two" } },
  };
}

function textRow(content: unknown): ActionRow {
  return {
    status: "done",
    action: { action: "file_extract", path: "report.txt" },
    result: { detail: { content } },
  };
}

const check: OutcomeCheck = {
  path: "orders.xlsx",
  sheet: "Orders 2026",
  cell: "B2",
  equals: "2",
};
const defaultCheck: OutcomeCheck = {
  path: "orders.xlsx",
  cell: "B2",
  equals: "2",
};
const sheetCheck: OutcomeCheck = {
  path: "orders.xlsx",
  sheet: "Orders 2026",
};
const bothSheets = ["Orders 2026", "Other"];
const oldProof = row(workbook("Orders 2026", 2, bothSheets));
const otherRead = row(workbook("Other", 7, bothSheets));
const removedSheet = row(workbook("Other", 7, ["Other"]));

type VerificationCase = [string, ActionRow[], OutcomeCheck, boolean];

// Exercise the exported completion gate rather than a copied cell matcher.
const cases: VerificationCase[] = [
  [
    "wrong sheet with doubled spaces",
    [row(workbook("Orders  2026"))],
    check,
    false,
  ],
  [
    "exact doubled spaces",
    [row(workbook("Orders  2026"))],
    { ...check, sheet: "Orders  2026" },
    true,
  ],
  [
    "case-only sheet names",
    [row(workbook("ORDERS 2026"))],
    check,
    true,
  ],
  [
    "leading-space sheet is distinct",
    [row(workbook(" Orders 2026"))],
    check,
    false,
  ],
  [
    "deleted requested sheet invalidates old proof",
    [oldProof, removedSheet],
    check,
    false,
  ],
  [
    "renamed requested sheet invalidates old proof",
    [oldProof, row(workbook("Renamed", 7))],
    check,
    false,
  ],
  [
    "another sheet read preserves uninterrupted target proof",
    [oldProof, otherRead],
    check,
    true,
  ],
  [
    "empty latest inventory invalidates old proof",
    [oldProof, row(workbook("Other", 7, []))],
    check,
    false,
  ],
  [
    "missing latest inventory is not a fresh oracle",
    [oldProof, row({ sheet: "Other", cells: [] })],
    check,
    false,
  ],
  [
    "default first sheet follows latest inventory",
    [oldProof, row(workbook("Orders 2026", 2, ["Other", "Orders 2026"]))],
    defaultCheck,
    false,
  ],
  [
    "array is not a scalar value",
    [row(workbook("Orders 2026", [2]))],
    check,
    false,
  ],
  [
    "numeric strings compare by value",
    [row(workbook("Orders 2026", "2.0"))],
    check,
    true,
  ],
  [
    "boolean scalar",
    [row(workbook("Orders 2026", true))],
    { ...check, equals: "true" },
    true,
  ],
  [
    "missing value is not zero",
    [row(workbook("Orders 2026", null))],
    { ...check, equals: "0" },
    false,
  ],
  [
    "value in wrong row",
    [row(workbook("Orders 2026", 2, ["Orders 2026"], "B3"))],
    check,
    false,
  ],
  [
    "latest contradictory value wins",
    [oldProof, row(workbook("Orders 2026", 9))],
    check,
    false,
  ],
  [
    "sheet-only whitespace identity",
    [row(workbook("Orders  2026"))],
    sheetCheck,
    false,
  ],
  [
    "sheet-only exact populated sheet",
    [row(workbook("Orders 2026"))],
    sheetCheck,
    true,
  ],
  [
    "sheet-only case insensitive",
    [row(workbook("ORDERS 2026"))],
    sheetCheck,
    true,
  ],
  [
    "recreated name does not restore old proof",
    [oldProof, removedSheet, otherRead],
    check,
    false,
  ],
  [
    "fresh reread after recreation proves current cell",
    [oldProof, removedSheet, otherRead, oldProof],
    check,
    true,
  ],
  [
    "malformed intermediate inventory invalidates old proof",
    [oldProof, row({ sheet: "Other", cells: [] }), otherRead],
    check,
    false,
  ],
  [
    "default first-sheet recreation needs fresh proof",
    [
      oldProof,
      row(workbook("Other", 7, ["Other", "Orders 2026"])),
      otherRead,
    ],
    defaultCheck,
    false,
  ],
  [
    "no workbook is no proof",
    [row(undefined)],
    check,
    false,
  ],
  [
    "malformed historical default name invalidates old proof",
    [
      oldProof,
      row({
        ...workbook("Other", 7),
        sheets: [{ name: 42 }, { name: "Orders 2026" }, { name: "Other" }],
      }),
      otherRead,
    ],
    defaultCheck,
    false,
  ],
  [
    "old proof cannot survive missing current target grid",
    [oldProof, row({ sheet: "Orders 2026", sheets: workbook("Orders 2026").sheets })],
    check,
    false,
  ],
  [
    "old proof cannot survive a non-array current target grid",
    [oldProof, row({ ...workbook("Orders 2026"), cells: {} })],
    check,
    false,
  ],
  [
    "old proof cannot survive a malformed current target row",
    [oldProof, row({ ...workbook("Orders 2026"), cells: [null] })],
    check,
    false,
  ],
  [
    "old proof cannot survive malformed cells before a matching cell",
    [
      oldProof,
      row({
        ...workbook("Orders 2026"),
        cells: [[null, { cell: "B2", value: 2 }]],
      }),
    ],
    check,
    false,
  ],
  [
    "old proof cannot survive malformed cells after a matching cell",
    [
      oldProof,
      row({
        ...workbook("Orders 2026"),
        cells: [
          [
            { cell: "B2", value: 2 },
            { cell: 42, value: 2 },
          ],
        ],
      }),
    ],
    check,
    false,
  ],
  [
    "old proof cannot survive an unknown selected sheet",
    [oldProof, row({ ...workbook("Other", 7, bothSheets), sheet: 42 })],
    check,
    false,
  ],
  [
    "old proof cannot survive an empty selected sheet",
    [oldProof, row({ ...workbook("Other", 7, bothSheets), sheet: "" })],
    check,
    false,
  ],
  [
    "selected sheet absent from its own inventory is not another-sheet proof",
    [oldProof, row(workbook("Ghost", 7, bothSheets))],
    check,
    false,
  ],
  [
    "duplicate target coordinates cannot select the first matching value",
    [
      oldProof,
      row({
        ...workbook("Orders 2026"),
        cells: [
          [{ cell: "B2", value: 2 }],
          [{ cell: "b2", value: 9 }],
        ],
      }),
    ],
    check,
    false,
  ],
  [
    "duplicate matching coordinates remain ambiguous",
    [
      row({
        ...workbook("Orders 2026"),
        cells: [
          [
            { cell: "B2", value: 2 },
            { cell: "b2", value: 2 },
          ],
        ],
      }),
    ],
    check,
    false,
  ],
  [
    "empty current target grid contradicts old proof",
    [oldProof, row({ ...workbook("Orders 2026"), cells: [] })],
    check,
    false,
  ],
  [
    "fresh target reread replaces poisoned evidence",
    [
      oldProof,
      row({ ...workbook("Orders 2026"), cells: [null] }),
      oldProof,
    ],
    check,
    true,
  ],
  [
    "explicit other-sheet selection preserves proof without its cell grid",
    [oldProof, row({ sheet: "Other", sheets: workbook("Other", 7, bothSheets).sheets })],
    check,
    true,
  ],
  [
    "NaN is not a numeric cell result",
    [row(workbook("Orders 2026", NaN))],
    { ...check, equals: "NaN" },
    false,
  ],
  [
    "Infinity is not a numeric cell result",
    [row(workbook("Orders 2026", Infinity))],
    { ...check, equals: "Infinity" },
    false,
  ],
  [
    "an object is not a scalar cell result",
    [row(workbook("Orders 2026", { value: 2 }))],
    check,
    false,
  ],
  [
    "formula equality remains supported",
    [
      row({
        ...workbook("Orders 2026", 3),
        cells: [[{ cell: "B2", value: 3, formula: "=SUM(A1:A2)" }]],
      }),
    ],
    { ...check, equals: "=SUM(A1:A2)" },
    true,
  ],
  [
    "missing latest sheet-only workbook invalidates old inventory",
    [oldProof, row(undefined)],
    sheetCheck,
    false,
  ],
  [
    "null latest sheet-only workbook invalidates old inventory",
    [oldProof, row(null)],
    sheetCheck,
    false,
  ],
  [
    "NaN media time is not valid paused proof",
    [mediaRow(NaN)],
    { pausedAt: 0 },
    false,
  ],
  [
    "Infinity media time is not valid paused proof",
    [mediaRow(Infinity)],
    { pausedAt: 0 },
    false,
  ],
  [
    "-Infinity media time is not valid paused proof",
    [mediaRow(-Infinity)],
    { pausedAt: 0 },
    false,
  ],
  [
    "-1 media time is not valid paused proof",
    [mediaRow(-1)],
    { pausedAt: 0 },
    false,
  ],
  [
    "valid zero paused time",
    [mediaRow(0)],
    { pausedAt: 0 },
    true,
  ],
  [
    "valid positive paused time",
    [mediaRow(12.25)],
    { pausedAt: 12 },
    true,
  ],
  [
    "paused time outside tolerance",
    [mediaRow(12.75)],
    { pausedAt: 12 },
    false,
  ],
  [
    "playing media is not paused proof",
    [mediaRow(12, false)],
    { pausedAt: 12 },
    false,
  ],
  [
    "missing latest media receipt invalidates old paused proof",
    [
      mediaRow(12),
      {
        status: "done",
        action: { action: "media", op: "state" },
        result: { detail: {} },
      },
    ],
    { pausedAt: 12 },
    false,
  ],
  [
    "null latest media receipt invalidates old paused proof",
    [
      mediaRow(12),
      {
        status: "done",
        action: { action: "media", op: "state" },
        result: null,
      },
    ],
    { pausedAt: 12 },
    false,
  ],
  [
    "NaN page count cannot satisfy a minimum-only check",
    [infoRow({ pages: NaN })],
    { path: "report.pdf", measures: [{ name: "pages", min: 1 }] },
    false,
  ],
  [
    "NaN page count cannot satisfy a maximum-only check",
    [infoRow({ pages: NaN })],
    { path: "report.pdf", measures: [{ name: "pages", max: 10 }] },
    false,
  ],
  [
    "Infinity page count cannot satisfy a minimum-only check",
    [infoRow({ pages: Infinity })],
    { path: "report.pdf", measures: [{ name: "pages", min: 1 }] },
    false,
  ],
  [
    "Infinity page count cannot satisfy a maximum-only check",
    [infoRow({ pages: Infinity })],
    { path: "report.pdf", measures: [{ name: "pages", max: 10 }] },
    false,
  ],
  [
    "-Infinity page count cannot satisfy a minimum-only check",
    [infoRow({ pages: -Infinity })],
    { path: "report.pdf", measures: [{ name: "pages", min: 1 }] },
    false,
  ],
  [
    "-Infinity page count cannot satisfy a maximum-only check",
    [infoRow({ pages: -Infinity })],
    { path: "report.pdf", measures: [{ name: "pages", max: 10 }] },
    false,
  ],
  [
    "finite measured page count",
    [infoRow({ pages: 2 })],
    { path: "report.pdf", measures: [{ name: "pages", min: 1, max: 3 }] },
    true,
  ],
  [
    "negative finite loudness is legitimate",
    [infoRow({ loudness: -14 })],
    { path: "report.pdf", measures: [{ name: "loudness", min: -16, max: -12 }] },
    true,
  ],
  [
    "missing latest file_info invalidates an old measurement",
    [
      infoRow({ pages: 2 }),
      {
        status: "done",
        action: { action: "file_info", path: "report.pdf" },
        result: { detail: {} },
      },
    ],
    { path: "report.pdf", measures: [{ name: "pages", min: 1 }] },
    false,
  ],
  [
    "null latest file_info invalidates an old measurement",
    [
      infoRow({ pages: 2 }),
      {
        status: "done",
        action: { action: "file_info", path: "report.pdf" },
        result: { detail: { info: null } },
      },
    ],
    { path: "report.pdf", measures: [{ name: "pages", min: 1 }] },
    false,
  ],
  [
    "NaN body word count is not valid proof",
    [wordsRow(NaN)],
    { path: "report.docx", maxWords: 10 },
    false,
  ],
  [
    "Infinity body word count is not valid proof",
    [wordsRow(Infinity)],
    { path: "report.docx", maxWords: 10 },
    false,
  ],
  [
    "-Infinity body word count is not valid proof",
    [wordsRow(-Infinity)],
    { path: "report.docx", maxWords: 10 },
    false,
  ],
  [
    "-1 body word count is not valid proof",
    [wordsRow(-1)],
    { path: "report.docx", maxWords: 10 },
    false,
  ],
  [
    "1.5 body word count is not valid proof",
    [wordsRow(1.5)],
    { path: "report.docx", maxWords: 10 },
    false,
  ],
  [
    "Number.MAX_SAFE_INTEGER + 1 body word count is not valid proof",
    [wordsRow(Number.MAX_SAFE_INTEGER + 1)],
    { path: "report.docx", maxWords: 10 },
    false,
  ],
  [
    "finite integer body word count",
    [wordsRow(2)],
    { path: "report.docx", minWords: 2, maxWords: 2 },
    true,
  ],
  [
    "zero body word count satisfies a maximum-only check",
    [wordsRow(0)],
    { path: "report.docx", maxWords: 1 },
    true,
  ],
  [
    "zero body word count cannot satisfy a minimum",
    [wordsRow(0)],
    { path: "report.docx", minWords: 1 },
    false,
  ],
  [
    "latest invalid body word count invalidates old count",
    [wordsRow(2), wordsRow(NaN)],
    { path: "report.docx", minWords: 2 },
    false,
  ],
  [
    "missing plaintext content is not a measured zero",
    [textRow(undefined)],
    { path: "report.txt", maxWords: 1 },
    false,
  ],
  [
    "null plaintext content is not a measured zero",
    [textRow(null)],
    { path: "report.txt", maxWords: 1 },
    false,
  ],
  [
    "object plaintext content is not a body word read",
    [textRow({ text: "one" })],
    { path: "report.txt", maxWords: 1 },
    false,
  ],
  [
    "actual empty plaintext supports a maximum-only check",
    [textRow("")],
    { path: "report.txt", maxWords: 1 },
    true,
  ],
  [
    "actual plaintext supports fallback word counting",
    [textRow("one two")],
    { path: "report.txt", minWords: 2, maxWords: 2 },
    true,
  ],
  [
    "missing latest plaintext invalidates an old word count",
    [textRow("one two"), textRow(undefined)],
    { path: "report.txt", minWords: 2 },
    false,
  ],
  [
    "truncated plaintext cannot supply a complete fallback count",
    [
      {
        ...textRow("one two"),
        result: { detail: { content: "one two", truncated: true } },
      },
    ],
    { path: "report.txt", maxWords: 2 },
    false,
  ],
  [
    "Infinity body word count cannot satisfy a minimum-only check",
    [wordsRow(Infinity)],
    { path: "report.docx", minWords: 2 },
    false,
  ],
  [
    "unsafe integer body word count cannot satisfy a minimum-only check",
    [wordsRow(Number.MAX_SAFE_INTEGER + 1)],
    { path: "report.docx", minWords: 2 },
    false,
  ],
  [
    "missing metadata is not existence proof",
    [{ status: "done", action: { action: "file_info", path: "report.pdf" }, result: { detail: { info: undefined } } }],
    { path: "report.pdf" },
    false,
  ],
  [
    "null metadata is not existence proof",
    [{ status: "done", action: { action: "file_info", path: "report.pdf" }, result: { detail: { info: null } } }],
    { path: "report.pdf" },
    false,
  ],
  [
    "array metadata is not existence proof",
    [{ status: "done", action: { action: "file_info", path: "report.pdf" }, result: { detail: { info: [] } } }],
    { path: "report.pdf" },
    false,
  ],
  [
    "negative file size is not existence proof",
    [{ status: "done", action: { action: "file_info", path: "report.pdf" }, result: { detail: { info: {"size":-1} } } }],
    { path: "report.pdf" },
    false,
  ],
  [
    "string file size is not existence proof",
    [{ status: "done", action: { action: "file_info", path: "report.pdf" }, result: { detail: { info: {"size":"10"} } } }],
    { path: "report.pdf" },
    false,
  ],
  [
    "fractional file size is not existence proof",
    [{ status: "done", action: { action: "file_info", path: "report.pdf" }, result: { detail: { info: {"size":1.5} } } }],
    { path: "report.pdf" },
    false,
  ],
  [
    "nonfinite file size is not existence proof",
    [{ status: "done", action: { action: "file_info", path: "report.pdf" }, result: { detail: { info: {"size":Infinity} } } }],
    { path: "report.pdf" },
    false,
  ],
  [
    "valid metadata proves file exists",
    [{ status: "done", action: { action: "file_info", path: "report.pdf" }, result: { detail: { info: {"size":10} } } }],
    { path: "report.pdf" },
    true,
  ],
  [
    "empty folder metadata proves folder exists",
    [{ status: "done", action: { action: "file_info", path: "report.pdf" }, result: { detail: { info: {"size":0,"folder":true} } } }],
    { path: "report.pdf" },
    true,
  ],
  [
    "empty file is not a finished deliverable",
    [{ status: "done", action: { action: "file_info", path: "report.pdf" }, result: { detail: { info: {"size":0,"folder":false} } } }],
    { path: "report.pdf" },
    false,
  ],
];

describe("completion verification requires current, valid device evidence", () => {
  it.each(cases)("%s", (_name, actions, check, accepted) => {
    const gap = verificationGap(actions, [check]);
    if (accepted) expect(gap).toBeNull();
    else expect(gap).not.toBeNull();
  });
});
