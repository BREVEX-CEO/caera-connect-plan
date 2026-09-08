import { describe, it, expect, afterAll } from "vitest";
import { watchConsole } from "./support/expected-console";
import { deflateRawSync } from "node:zlib";
import {
  decodeXlsx,
  decodePdf,
  decodeDocx,
  decodeBinaryDocument,
  isDecodableBinary,
  looksLikeFormat,
  MAX_SHEET_ROWS,
  XLSX_LIMITS,
  BINARY_LIMITS,
} from "../ocade-decoders";
import { extractBinaryDocument } from "../ocade-documents";

const encoder = new TextEncoder();
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

function bufferWithSignature(size: number, signature: number[]): ArrayBuffer {
  const bytes = new Uint8Array(size);
  bytes.set(signature);
  return bytes.buffer;
}

/** Build a standards-shaped, stored ZIP without relying on the parser under test. */
function makeZip(files: Record<string, string>, compressed = false): ArrayBuffer {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(text);
    const stored = compressed ? Uint8Array.from(deflateRawSync(data)) : data;
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length + stored.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, compressed ? 8 : 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, stored.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(stored, 30 + nameBytes.length);
    locals.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, compressed ? 8 : 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, stored.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centrals.push(central);
    offset += local.length;
  }
  const directory = concat(centrals);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, centrals.length, true);
  endView.setUint16(10, centrals.length, true);
  endView.setUint32(12, directory.length, true);
  endView.setUint32(16, offset, true);
  return concat([...locals, directory, end]).buffer as ArrayBuffer;
}

function xml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function columnName(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    n -= 1;
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26);
  }
  return out;
}

type FormulaFixture = { formula: string; cached: string | number };

function cellXml(value: unknown, row: number, column: number): string {
  const ref = `${columnName(column)}${row}`;
  if (value === null || value === undefined) return `<c r="${ref}"/>`;
  if (typeof value === "number") return `<c r="${ref}"><v>${value}</v></c>`;
  if (typeof value === "boolean") return `<c r="${ref}" t="b"><v>${value ? 1 : 0}</v></c>`;
  if (typeof value === "object" && "formula" in value) {
    const formula = value as FormulaFixture;
    return `<c r="${ref}" t="str"><f>${xml(formula.formula)}</f><v>${xml(formula.cached)}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"><is><t>${xml(value)}</t></is></c>`;
}

/** Build a real XLSX package in memory, independently of the decoder. */
function makeWorkbook(rowsBySheet: Record<string, unknown[][]>, compressed = false): ArrayBuffer {
  const sheets = Object.entries(rowsBySheet);
  const workbookSheets = sheets
    .map(
      ([name], index) =>
        `<sheet name="${xml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
    )
    .join("");
  const relationships = sheets
    .map(
      (_sheet, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
    )
    .join("");
  const files: Record<string, string> = {
    "[Content_Types].xml":
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>',
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships}</Relationships>`,
  };
  sheets.forEach(([, rows], sheetIndex) => {
    const rowXml = rows
      .map(
        (row, rowIndex) =>
          `<row r="${rowIndex + 1}">${row.map((value, column) => cellXml(value, rowIndex + 1, column)).join("")}</row>`,
      )
      .join("");
    files[`xl/worksheets/sheet${sheetIndex + 1}.xml`] =
      `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowXml}</sheetData></worksheet>`;
  });
  return makeZip(files, compressed);
}

describe("isDecodableBinary", () => {
  it.each(["pdf", "docx", "xlsx"])("accepts %s", (k) => expect(isDecodableBinary(k)).toBe(true));
  it.each(["txt", "png", "zip"])("rejects %s", (k) => expect(isDecodableBinary(k)).toBe(false));
});

describe("decodeXlsx (real workbook)", () => {
  it("extracts cells and reports sheet names", async () => {
    const buf = makeWorkbook({
      Budget: [
        ["name", "qty"],
        ["bolt", 9],
      ],
    });
    const r = await decodeXlsx(buf);
    expect(r.status).toBe("ok");
    expect(r.meta.sheets).toContain("Budget");
    expect(r.text).toContain("bolt");
    expect(r.text).toContain("[sheet Budget]");
    expect(r.sections[0].sheet).toBe("Budget");
  });

  it("keeps every sheet as its own citable section", async () => {
    const buf = makeWorkbook({ One: [["a"]], Two: [["b"]] });
    const r = await decodeXlsx(buf);
    expect(r.sections.map((s) => s.sheet)).toEqual(["One", "Two"]);
  });

  it("reads the deflated ZIP entries used by ordinary Excel workbooks", async () => {
    const r = await decodeXlsx(makeWorkbook({ Compressed: [["real", "xlsx"]] }, true));
    expect(r.status).toBe("ok");
    expect(r.text).toContain("real | xlsx");
  });

  it("bounds very large sheets and says so", async () => {
    const rows = Array.from({ length: MAX_SHEET_ROWS + 25 }, (_, i) => [`r${i}`]);
    const r = await decodeXlsx(makeWorkbook({ Big: rows }));
    expect(r.status).toBe("ok");
    expect(r.text).toMatch(/more rows/);
  });

  it("reports an empty workbook honestly", async () => {
    const r = await decodeXlsx(makeWorkbook({ Blank: [] }));
    expect(r.status).toBe("empty");
    expect(r.text).toBe("");
    expect(r.reason).toBeTruthy();
  });

  it("reports corrupt input instead of returning empty text", async () => {
    const r = await decodeXlsx(new TextEncoder().encode("not a spreadsheet").buffer as ArrayBuffer);
    expect(r.status).toBe("corrupt");
    expect(r.reason).toMatch(/damaged/i);
  });

  it("never executes or exposes a formula, but may use its cached plain value", async () => {
    const r = await decodeXlsx(
      makeWorkbook({
        Safe: [[{ formula: 'HYPERLINK("https://evil.test","click")', cached: "cached result" }]],
      }),
    );
    expect(r.status).toBe("ok");
    expect(r.text).toContain("cached result");
    expect(r.text).not.toContain("HYPERLINK");
    expect(r.text).not.toContain("evil.test");
  });

  it("decodes XML entities as cell text, never markup", async () => {
    const r = await decodeXlsx(makeWorkbook({ Text: [["A & B < C"]] }));
    expect(r.text).toContain("A & B < C");
  });

  it("refuses legacy OLE .xls honestly instead of passing it to an unsafe parser", async () => {
    const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0]).buffer;
    const r = await decodeXlsx(ole);
    expect(r.status).toBe("unsupported");
    expect(r.reason).toMatch(/legacy.*xls/i);
  });

  it("fails closed on an unsafe archive path", async () => {
    const r = await decodeXlsx(makeZip({ "../xl/workbook.xml": "<workbook/>" }));
    expect(r.status).toBe("corrupt");
  });

  it("refuses a worksheet beyond the bounded cell count", async () => {
    const cells = Array.from({ length: XLSX_LIMITS.sheetCells + 1 }, () => ["x"]);
    const r = await decodeXlsx(makeWorkbook({ Huge: cells }));
    expect(r.status).toBe("unsupported");
    expect(r.reason).toMatch(/safe local reading limits/i);
  });
});

describe("format signature validation", () => {
  // Signature checks stop junk masquerading as a real document.
  it("recognises real containers", () => {
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0]).buffer;
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]).buffer;
    expect(looksLikeFormat("xlsx", zip)).toBe(true);
    expect(looksLikeFormat("docx", zip)).toBe(true);
    expect(looksLikeFormat("pdf", pdf)).toBe(true);
  });

  it("rejects plain text pretending to be a document", () => {
    const junk = new TextEncoder().encode("just some words").buffer as ArrayBuffer;
    expect(looksLikeFormat("xlsx", junk)).toBe(false);
    expect(looksLikeFormat("docx", junk)).toBe(false);
    expect(looksLikeFormat("pdf", junk)).toBe(false);
  });

  it("rejects a buffer shorter than the signature", () => {
    expect(looksLikeFormat("pdf", new ArrayBuffer(2))).toBe(false);
  });
});

describe("decodePdf / decodeDocx corrupt handling", () => {
  it("reports a corrupt PDF rather than empty text", async () => {
    const r = await decodePdf(new TextEncoder().encode("%PDF-broken").buffer as ArrayBuffer);
    expect(["corrupt", "encrypted", "empty"]).toContain(r.status);
    expect(r.text).toBe("");
    expect(r.reason).toBeTruthy();
  });

  it("reports a corrupt DOCX rather than empty text", async () => {
    const r = await decodeDocx(new TextEncoder().encode("not-a-docx").buffer as ArrayBuffer);
    expect(r.status).toBe("corrupt");
    expect(r.text).toBe("");
  });
});

describe("binary decoder cancellation and resource budgets", () => {
  it("threads a pre-aborted signal through each direct decoder", async () => {
    const controller = new AbortController();
    controller.abort();
    const pdf = bufferWithSignature(8, [0x25, 0x50, 0x44, 0x46]);
    const docx = makeZip({ "word/document.xml": "<document/>" });
    const xlsx = makeWorkbook({ Sheet: [["value"]] });

    await expect(decodePdf(pdf, controller.signal)).resolves.toMatchObject({
      status: "cancelled",
    });
    await expect(decodeDocx(docx, controller.signal)).resolves.toMatchObject({
      status: "cancelled",
    });
    await expect(decodeXlsx(xlsx, controller.signal)).resolves.toMatchObject({
      status: "cancelled",
    });
  });

  it("cooperatively cancels a workbook while worksheet rows are being parsed", async () => {
    const controller = new AbortController();
    const rows = Array.from({ length: 10_000 }, (_, index) => [`row-${index}`]);
    const pending = decodeXlsx(makeWorkbook({ Large: rows }), controller.signal);
    setTimeout(() => controller.abort(), 0);

    const result = await pending;
    expect(result.status).toBe("cancelled");
    expect(result.reason).toBeTruthy();
    expect(result.text).toBe("");
    expect(result.sections).toEqual([]);
  });

  it("refuses oversized PDF and DOCX inputs before loading their parsers", async () => {
    const pdf = bufferWithSignature(BINARY_LIMITS.pdf.inputBytes + 1, [0x25, 0x50, 0x44, 0x46]);
    const docx = bufferWithSignature(BINARY_LIMITS.docx.inputBytes + 1, [0x50, 0x4b, 0x03, 0x04]);

    await expect(decodePdf(pdf)).resolves.toMatchObject({ status: "unsupported" });
    await expect(decodeDocx(docx)).resolves.toMatchObject({ status: "unsupported" });
  });
});

describe("decodeBinaryDocument", () => {
  it("honours cancellation before work starts", async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const r = await decodeBinaryDocument("xlsx", makeWorkbook({ S: [["a"]] }), ctrl.signal);
    // Previously asserted "corrupt" — that codified a bug: a user who cancels
    // was told their file might be damaged.
    expect(r.status).toBe("cancelled");
    expect(r.reason).toMatch(/cancelled/i);
  });

  it("routes to the right decoder", async () => {
    const r = await decodeBinaryDocument("xlsx", makeWorkbook({ S: [["hello"]] }));
    expect(r.status).toBe("ok");
    expect(r.text).toContain("hello");
  });
});

describe("extractBinaryDocument (unified contract)", () => {
  it("returns ok with sheet metadata for a real workbook", async () => {
    const buf = makeWorkbook({ Data: [["x", "y"]] });
    const r = await extractBinaryDocument({
      name: "book.xlsx",
      sizeBytes: buf.byteLength,
      buffer: buf,
    });
    expect(r.status).toBe("ok");
    expect(r.meta.sheets).toContain("Data");
    expect(r.text).toContain("x");
  });

  it("surfaces a corrupt file as unsupported with the real reason, not fake text", async () => {
    const bad = new TextEncoder().encode("garbage").buffer as ArrayBuffer;
    const r = await extractBinaryDocument({ name: "b.xlsx", sizeBytes: 7, buffer: bad });
    expect(r.text).toBeNull();
    expect(r.reason).toBeTruthy();
  });

  it("refuses a non-decodable type", async () => {
    const r = await extractBinaryDocument({
      name: "photo.png",
      mime: "image/png",
      sizeBytes: 4,
      buffer: new ArrayBuffer(4),
    });
    expect(r.status).toBe("unsupported");
    expect(r.text).toBeNull();
  });
});

/**
 * A cancellation is NOT a corrupt file.
 *
 * Reporting an aborted read as `corrupt` told the user their document may be
 * damaged when they had simply changed their mind — and it made the honest
 * corrupt-file state untrustworthy, because it now fired for a benign action.
 */
describe("cancelling a read", () => {
  const pdfBytes = new TextEncoder().encode("%PDF-1.4\n...").buffer;

  it("reports `cancelled`, never `corrupt`, when aborted before starting", async () => {
    const c = new AbortController();
    c.abort();
    const r = await decodeBinaryDocument("pdf", pdfBytes, c.signal);
    expect(r.status).toBe("cancelled");
    expect(r.status).not.toBe("corrupt");
  });

  it("says nothing was added, so the user knows the file was not attached", async () => {
    const c = new AbortController();
    c.abort();
    const r = await decodeBinaryDocument("pdf", pdfBytes, c.signal);
    if (r.status === "ok") throw new Error("unreachable");
    expect(r.reason).toMatch(/cancelled/i);
    expect(r.reason).not.toMatch(/damaged|corrupt/i);
  });

  it("does not mention damage — that wording belongs to a real corrupt file", async () => {
    const c = new AbortController();
    c.abort();
    const r = await decodeBinaryDocument("docx", pdfBytes, c.signal);
    if (r.status === "ok") throw new Error("unreachable");
    expect(r.reason?.toLowerCase()).not.toContain("damaged");
  });

  it("still decodes normally when no signal is supplied", async () => {
    const r = await decodeBinaryDocument("pdf", pdfBytes);
    // Whatever the outcome, it must not be reported as a cancellation.
    expect(r.status).not.toBe("cancelled");
  });
});

/**
 * Console output this audit legitimately causes, classified rather than muted.
 *
 * The shared list in `support/expected-console.ts` says why each message is
 * correct behaviour. Anything NOT on it still reaches the console and fails the
 * assertion below, so a new error cannot hide inside expected noise.
 */
const consoleWatch = watchConsole();
afterAll(() => consoleWatch.restore());

describe("the console during this audit", () => {
  it("carries nothing this harness cannot account for", () => {
    expect(consoleWatch.unexpected.slice(0, 5)).toEqual([]);
  });
});
