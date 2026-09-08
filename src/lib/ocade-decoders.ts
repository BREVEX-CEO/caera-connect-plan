/**
 * OCADE binary document decoders (Plan §18, decision #44).
 *
 * Real on-device extraction for PDF, DOCX and XLSX. Everything runs in the
 * browser: the file is decoded from an ArrayBuffer the user already selected and
 * is never uploaded. PDF and DOCX decoders are imported DYNAMICALLY so their
 * weight is only paid when someone actually attaches one of these formats.
 *
 * Every result carries locators (page / sheet) so citations can point at the
 * exact place a claim came from, and every failure is reported honestly —
 * corrupt, encrypted and empty files are distinguished from one another rather
 * than silently producing empty text.
 */

export type DecodeStatus =
  | "ok"
  | "empty"
  | "encrypted"
  | "corrupt"
  | "unsupported"
  /** The user stopped the read. Distinct from a damaged file. */
  | "cancelled";

export const CANCELLED_REASON = "Reading was cancelled. Nothing was added.";

export const BINARY_LIMITS = {
  pdf: {
    inputBytes: 32 * 1024 * 1024,
    pages: 500,
    pageChars: 50_000,
    outputChars: 250_000,
  },
  docx: {
    inputBytes: 32 * 1024 * 1024,
    zipEntries: 1_024,
    uncompressedBytes: 64 * 1024 * 1024,
    outputChars: 250_000,
    sections: 2_000,
  },
} as const;

export interface DecodedSection {
  /** 1-based page (PDF) or sheet name (XLSX); absent for flat documents. */
  page?: number;
  sheet?: string;
  text: string;
}

export interface DecodeResult {
  status: DecodeStatus;
  /** Joined plain text, ready for model context. */
  text: string;
  sections: DecodedSection[];
  /** Honest, user-facing explanation when status !== "ok". */
  reason?: string;
  meta: {
    pages?: number;
    sheets?: string[];
    wordCount?: number;
  };
}

function fail(status: DecodeStatus, reason: string): DecodeResult {
  return { status, text: "", sections: [], reason, meta: {} };
}

class DecodeCancelledError extends Error {}
class DocumentLimitError extends Error {}

function assertNotCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DecodeCancelledError(CANCELLED_REASON);
}

async function abortable<T>(
  operation: Promise<T>,
  signal?: AbortSignal,
  onAbort?: () => void,
): Promise<T> {
  if (!signal) return operation;
  assertNotCancelled(signal);
  return new Promise<T>((resolve, reject) => {
    const abort = () => {
      onAbort?.();
      reject(new DecodeCancelledError(CANCELLED_REASON));
    };
    signal.addEventListener("abort", abort, { once: true });
    operation.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
  });
}

async function cancellationYield(signal?: AbortSignal): Promise<void> {
  assertNotCancelled(signal);
  if (!signal) return;
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  assertNotCancelled(signal);
}

function countWords(s: string): number {
  const m = s.trim().match(/\S+/g);
  return m ? m.length : 0;
}

/** Signals a password-protected PDF/Office file rather than a broken one. */
function looksEncrypted(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /password|encrypt|protected/i.test(msg);
}

function startsWith(buffer: ArrayBuffer, sig: number[]): boolean {
  if (buffer.byteLength < sig.length) return false;
  const head = new Uint8Array(buffer, 0, sig.length);
  return sig.every((b, i) => head[i] === b);
}

/** ZIP container — the real format behind .docx and .xlsx. */
const ZIP = [0x50, 0x4b, 0x03, 0x04];
/** Legacy OLE compound file — .xls / .doc. */
const OLE = [0xd0, 0xcf, 0x11, 0xe0];
/** "%PDF" */
const PDF = [0x25, 0x50, 0x44, 0x46];

/**
 * Verify the bytes really are the claimed format before decoding.
 *
 * This matters because permissive parsers can interpret arbitrary text as a
 * single-column sheet, which would let junk masquerade as a real spreadsheet.
 * A signature check makes that an honest, explicit outcome.
 */
export function looksLikeFormat(kind: BinaryKind, buffer: ArrayBuffer): boolean {
  switch (kind) {
    case "pdf":
      return startsWith(buffer, PDF);
    case "docx":
      return startsWith(buffer, ZIP);
    case "xlsx":
      return startsWith(buffer, ZIP) || startsWith(buffer, OLE);
    default:
      return false;
  }
}

/* ------------------------------------------------------------------ PDF -- */

export async function decodePdf(buffer: ArrayBuffer, signal?: AbortSignal): Promise<DecodeResult> {
  if (signal?.aborted) return fail("cancelled", CANCELLED_REASON);
  if (buffer.byteLength > BINARY_LIMITS.pdf.inputBytes) {
    return fail("unsupported", "This PDF is larger than OCADE's 32 MB local reading limit.");
  }
  if (!looksLikeFormat("pdf", buffer)) {
    return fail("corrupt", "This PDF could not be read — the file may be damaged.");
  }
  let destroyTask: (() => Promise<void>) | null = null;
  try {
    const pdfjs = await abortable(import("pdfjs-dist"), signal);
    assertNotCancelled(signal);
    // Run the parser inline: no CDN worker (the CSP forbids external hosts) and
    // no network access required.
    const task = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useWorkerFetch: false,
      disableFontFace: true,
    });
    let destroying: Promise<void> | null = null;
    destroyTask = () => {
      destroying ??= task.destroy().catch(() => undefined);
      return destroying;
    };
    const doc = await abortable(task.promise, signal, () => void destroyTask?.());
    if (doc.numPages > BINARY_LIMITS.pdf.pages) {
      throw new DocumentLimitError(`the document has more than ${BINARY_LIMITS.pdf.pages} pages`);
    }
    const sections: DecodedSection[] = [];
    let outputChars = 0;

    for (let p = 1; p <= doc.numPages; p++) {
      assertNotCancelled(signal);
      const page = await abortable(doc.getPage(p), signal, () => void destroyTask?.());
      const content = await abortable(page.getTextContent(), signal, () => void destroyTask?.());
      const text = content.items
        .map((it) =>
          typeof it === "object" && it && "str" in it ? String((it as { str: string }).str) : "",
        )
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (text.length > BINARY_LIMITS.pdf.pageChars) {
        throw new DocumentLimitError(`page ${p} exceeds the safe extracted-text limit`);
      }
      if (text) {
        outputChars += text.length;
        if (outputChars > BINARY_LIMITS.pdf.outputChars) {
          throw new DocumentLimitError("the extracted text exceeds the safe output limit");
        }
        sections.push({ page: p, text });
      }
      await cancellationYield(signal);
    }

    if (sections.length === 0) {
      return {
        status: "empty",
        text: "",
        sections: [],
        reason:
          "This PDF has no extractable text — it is most likely a scan. OCADE can read it as an image instead.",
        meta: { pages: doc.numPages },
      };
    }
    const text = sections.map((s) => `[page ${s.page}]\n${s.text}`).join("\n\n");
    return {
      status: "ok",
      text,
      sections,
      meta: { pages: doc.numPages, wordCount: countWords(text) },
    };
  } catch (e) {
    if (e instanceof DecodeCancelledError) return fail("cancelled", CANCELLED_REASON);
    if (e instanceof DocumentLimitError) {
      return fail(
        "unsupported",
        `This PDF exceeds OCADE's safe local reading limits: ${e.message}.`,
      );
    }
    return looksEncrypted(e)
      ? fail("encrypted", "This PDF is password-protected. Unlock it first, then attach it again.")
      : fail("corrupt", "This PDF could not be read — the file may be damaged.");
  } finally {
    // The loading task owns the worker/document resources. Destroy it on every
    // exit path, including cancellation, parser failure, and safe-limit refusal.
    await destroyTask?.();
  }
}

/* ----------------------------------------------------------------- DOCX -- */

export async function decodeDocx(buffer: ArrayBuffer, signal?: AbortSignal): Promise<DecodeResult> {
  if (signal?.aborted) return fail("cancelled", CANCELLED_REASON);
  if (buffer.byteLength > BINARY_LIMITS.docx.inputBytes) {
    return fail("unsupported", "This document is larger than OCADE's 32 MB local reading limit.");
  }
  if (!looksLikeFormat("docx", buffer)) {
    return fail("corrupt", "This document could not be read — the file may be damaged.");
  }
  try {
    /*
     * READ AS A ZIP, WHICH IS WHAT A .docx IS.
     *
     * THIS REPLACED MAMMOTH, AND THE TRADE IS WORTH STATING. Mammoth is an
     * excellent library for turning Word documents into styled HTML, and 487
     * KiB of the shipped bundle went to it — for one call, `extractRawText`,
     * whose entire job is to throw all of that away and return plain text.
     * `PLAN.md` §26 caps total JavaScript at 4,200 KiB, and half a megabyte for
     * a feature that discards its own output is where the budget was going.
     *
     * NOT A NEW AUTHORITY. The spreadsheet decoder below already opens an
     * OOXML archive, reads an XML part and pulls text out of it using these
     * exact helpers. A .docx is the same shape, so this is the existing pattern
     * applied to the neighbouring format rather than a second way of doing it.
     *
     * WHAT CAME BACK IN THE BARGAIN: cancellation. Mammoth has no AbortSignal
     * API, so a cancelled decode used to race it and discard the result while
     * the work carried on. This yields to the signal between paragraphs, so a
     * cancel actually stops.
     */
    const entries = parseZip(buffer, BINARY_LIMITS.docx);
    const document = await readZipText(buffer, entries, "word/document.xml", signal);
    const text = (await extractDocxText(document, signal)).replace(/\n{3,}/g, "\n\n").trim();
    if (text.length > BINARY_LIMITS.docx.outputChars) {
      throw new DocumentLimitError("the extracted text exceeds the safe output limit");
    }
    if (!text) {
      return {
        status: "empty",
        text: "",
        sections: [],
        reason: "This document has no readable text.",
        meta: {},
      };
    }
    // Split on blank lines so citations can reference a section index.
    const sections = text
      .split(/\n{2,}/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => ({ text: t }));
    if (sections.length > BINARY_LIMITS.docx.sections) {
      throw new DocumentLimitError(
        `the document has more than ${BINARY_LIMITS.docx.sections} text sections`,
      );
    }
    return { status: "ok", text, sections, meta: { wordCount: countWords(text) } };
  } catch (e) {
    if (e instanceof DecodeCancelledError) return fail("cancelled", CANCELLED_REASON);
    if (e instanceof DocumentLimitError) {
      return fail(
        "unsupported",
        `This document exceeds OCADE's safe local reading limits: ${e.message}.`,
      );
    }
    return looksEncrypted(e)
      ? fail("encrypted", "This document is protected. Unlock it first, then attach it again.")
      : fail("corrupt", "This document could not be read — the file may be damaged.");
  }
}

/* ----------------------------------------------------------------- XLSX -- */

/** Bound the rows pulled from any single sheet so a huge workbook stays usable. */
export const MAX_SHEET_ROWS = 200;
export const XLSX_LIMITS = {
  inputBytes: 32 * 1024 * 1024,
  zipEntries: 256,
  uncompressedBytes: 64 * 1024 * 1024,
  xmlBytes: 8 * 1024 * 1024,
  workbookSheets: 64,
  sharedStrings: 50_000,
  sharedStringChars: 2 * 1024 * 1024,
  sheetCells: 100_000,
  rowColumns: 256,
  cellChars: 4_096,
  outputChars: 250_000,
} as const;

type ZipEntry = {
  name: string;
  flags: number;
  method: number;
  crc: number;
  compressedSize: number;
  uncompressedSize: number;
  localOffset: number;
};

const UTF8 = new TextDecoder("utf-8", { fatal: true });
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

function normalizeZipPath(name: string): string {
  const normalized = name.replace(/\\/g, "/").replace(/^\.\/+/, "");
  const parts = normalized.split("/");
  if (
    !normalized ||
    normalized.startsWith("/") ||
    /^[a-z]:/i.test(normalized) ||
    parts.some((part) => part === ".." || part.includes("\0"))
  ) {
    throw new Error("Unsafe spreadsheet archive path.");
  }
  return parts.filter((part) => part && part !== ".").join("/");
}

function resolveZipTarget(baseFile: string, target: string): string | null {
  if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("/")) return null;
  const base = baseFile.split("/").slice(0, -1);
  for (const part of target.replace(/\\/g, "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (base.length === 0) return null;
      base.pop();
    } else {
      base.push(part);
    }
  }
  return normalizeZipPath(base.join("/"));
}

type ArchiveLimits = {
  inputBytes: number;
  zipEntries: number;
  uncompressedBytes: number;
};

function parseZip(buffer: ArrayBuffer, limits: ArchiveLimits): Map<string, ZipEntry> {
  if (buffer.byteLength > limits.inputBytes) {
    throw new DocumentLimitError("the file is larger than the safe local input limit");
  }
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const min = Math.max(0, bytes.length - 65_557);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= min; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Missing ZIP directory.");

  const disk = view.getUint16(eocd + 4, true);
  const directoryDisk = view.getUint16(eocd + 6, true);
  const diskEntries = view.getUint16(eocd + 8, true);
  const entryCount = view.getUint16(eocd + 10, true);
  const directorySize = view.getUint32(eocd + 12, true);
  const directoryOffset = view.getUint32(eocd + 16, true);
  const commentLength = view.getUint16(eocd + 20, true);
  if (
    disk !== 0 ||
    directoryDisk !== 0 ||
    diskEntries !== entryCount ||
    entryCount === 0xffff ||
    directoryOffset === 0xffffffff
  ) {
    throw new Error("Multi-disk and ZIP64 spreadsheets are not supported.");
  }
  if (entryCount > limits.zipEntries) {
    throw new DocumentLimitError(`the archive has more than ${limits.zipEntries} entries`);
  }
  if (eocd + 22 + commentLength > bytes.length || directoryOffset + directorySize > eocd) {
    throw new Error("Invalid ZIP directory.");
  }

  const entries = new Map<string, ZipEntry>();
  let cursor = directoryOffset;
  let totalUncompressed = 0;
  for (let i = 0; i < entryCount; i++) {
    if (cursor + 46 > bytes.length || view.getUint32(cursor, true) !== 0x02014b50) {
      throw new Error("Invalid ZIP entry.");
    }
    const flags = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    const crc = view.getUint32(cursor + 16, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const entryCommentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const next = cursor + 46 + nameLength + extraLength + entryCommentLength;
    if (next > bytes.length || compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
      throw new Error("Invalid or ZIP64 spreadsheet entry.");
    }
    if (flags & 1) throw new Error("This spreadsheet is encrypted.");
    if (method !== 0 && method !== 8) throw new Error("Unsupported ZIP compression.");
    const rawName = UTF8.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    const name = normalizeZipPath(rawName);
    if (entries.has(name)) throw new Error("Duplicate spreadsheet archive entry.");
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > limits.uncompressedBytes) {
      throw new DocumentLimitError("the expanded archive is larger than the safe local limit");
    }
    entries.set(name, {
      name,
      flags,
      method,
      crc,
      compressedSize,
      uncompressedSize,
      localOffset,
    });
    cursor = next;
  }
  return entries;
}

async function unzipEntry(
  buffer: ArrayBuffer,
  entry: ZipEntry,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  assertNotCancelled(signal);
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const at = entry.localOffset;
  if (at + 30 > bytes.length || view.getUint32(at, true) !== 0x04034b50) {
    throw new Error("Invalid ZIP local entry.");
  }
  const nameLength = view.getUint16(at + 26, true);
  const extraLength = view.getUint16(at + 28, true);
  const start = at + 30 + nameLength + extraLength;
  const end = start + entry.compressedSize;
  if (end > bytes.length) throw new Error("Truncated spreadsheet archive entry.");
  const compressed = bytes.subarray(start, end);
  let output: Uint8Array;
  if (entry.method === 0) {
    output = Uint8Array.from(compressed);
  } else {
    if (typeof DecompressionStream === "undefined") {
      throw new Error("Deflate decompression is unavailable in this browser.");
    }
    const raw = compressed.buffer.slice(
      compressed.byteOffset,
      compressed.byteOffset + compressed.byteLength,
    ) as ArrayBuffer;
    const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      assertNotCancelled(signal);
      const next = await abortable(reader.read(), signal, () => void reader.cancel());
      if (next.done) break;
      const chunk = new Uint8Array(next.value);
      total += chunk.byteLength;
      // Do not trust the central-directory size: a forged entry could claim a
      // few bytes and expand into a decompression bomb.
      if (total > entry.uncompressedSize || total > XLSX_LIMITS.xmlBytes) {
        await reader.cancel();
        throw new DocumentLimitError(
          "a compressed XML entry expands beyond its declared safe size",
        );
      }
      chunks.push(chunk);
    }
    output = new Uint8Array(total);
    let cursor = 0;
    for (const chunk of chunks) {
      output.set(chunk, cursor);
      cursor += chunk.byteLength;
    }
  }
  if (output.byteLength !== entry.uncompressedSize || crc32(output) !== entry.crc) {
    throw new Error("Spreadsheet archive checksum mismatch.");
  }
  return output;
}

async function readZipText(
  buffer: ArrayBuffer,
  entries: Map<string, ZipEntry>,
  name: string,
  signal?: AbortSignal,
): Promise<string> {
  assertNotCancelled(signal);
  const entry = entries.get(name);
  if (!entry) throw new Error(`Missing spreadsheet entry: ${name}`);
  if (entry.uncompressedSize > XLSX_LIMITS.xmlBytes) {
    throw new DocumentLimitError(`${name} is larger than the safe XML limit`);
  }
  return UTF8.decode(await unzipEntry(buffer, entry, signal));
}

function decodeXml(text: string): string {
  return text.replace(
    /&(?:#x([0-9a-f]+)|#([0-9]+)|amp|lt|gt|quot|apos);/gi,
    (entity, hex: string | undefined, decimal: string | undefined) => {
      if (hex) return String.fromCodePoint(Number.parseInt(hex, 16));
      if (decimal) return String.fromCodePoint(Number.parseInt(decimal, 10));
      return (
        {
          "&amp;": "&",
          "&lt;": "<",
          "&gt;": ">",
          "&quot;": '"',
          "&apos;": "'",
        }[entity.toLowerCase()] ?? entity
      );
    },
  );
}

function xmlAttribute(tag: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(?:^|\\s)${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(tag);
  return match ? decodeXml(match[1] ?? match[2] ?? "") : null;
}

function xmlTextNodes(xml: string): string {
  const parts: string[] = [];
  const re = /<t\b[^>]*>([\s\S]*?)<\/t>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) {
    parts.push(decodeXml(match[1].replace(/<[^>]+>/g, "")));
  }
  return parts.join("");
}

/**
 * The readable text of a Word document body, paragraph by paragraph.
 *
 * WHAT WORD ACTUALLY STORES. `word/document.xml` is a tree of `<w:p>`
 * paragraphs; each holds runs whose visible characters live in `<w:t>`. Tables
 * are made of paragraphs too, so walking paragraphs picks up table cells
 * without needing to understand tables at all.
 *
 * THE PARTS THAT ARE DELIBERATELY SKIPPED, each because including it would put
 * text on screen that the document does not show:
 *
 *   - `<w:instrText>` holds field CODES (`PAGE`, `HYPERLINK "..."`), not
 *     results. Including them leaks raw URLs and merge syntax into what the
 *     model reads as prose.
 *   - `<w:delText>` is text somebody DELETED under tracked changes. Reading it
 *     back would show a person deleted content as though it were still there.
 *
 * `<w:tab/>` and `<w:br/>` become real whitespace, because a tabbed list read
 * as one run-on word is not the document either.
 */
async function extractDocxText(xml: string, signal?: AbortSignal): Promise<string> {
  const body = /<w:body\b[^>]*>([\s\S]*?)<\/w:body>/i.exec(xml)?.[1] ?? xml;
  const paragraphs: string[] = [];
  /*
   * LAZY, AND THAT IS NOT A STYLE CHOICE.
   *
   * Written greedily — `<w:p\b[^>]*(?:\/>|>…)` — the character class eats the
   * self-closing slash of `<w:p/>`, the alternation then matches the bare `>`
   * branch, and the "paragraph" runs on to the NEXT `</w:p>`, swallowing the
   * paragraph after it. Word emits self-closing empty paragraphs for every
   * blank line, so that silently merged text throughout real documents while
   * every hand-written test case still passed.
   */
  const paragraphRe = /<w:p(?:\s[^>]*?)?(?:\/>|>([\s\S]*?)<\/w:p>)/gi;
  let match: RegExpExecArray | null;

  while ((match = paragraphRe.exec(body))) {
    // Between paragraphs rather than between characters: often enough to make
    // a cancel responsive, rarely enough not to dominate the work.
    if (paragraphs.length % 64 === 0) await cancellationYield(signal);
    assertNotCancelled(signal);

    const inner = match[1] ?? "";
    if (!inner) {
      paragraphs.push("");
      continue;
    }

    let line = "";
    const runRe = /<w:(t|tab|br)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/w:\1>)/gi;
    let run: RegExpExecArray | null;
    while ((run = runRe.exec(inner))) {
      const kind = run[1]!.toLowerCase();
      if (kind === "tab") {
        line += "\t";
      } else if (kind === "br") {
        line += "\n";
      } else {
        /*
         * `xml:space="preserve"` is how Word marks a run whose leading or
         * trailing spaces are meaningful. Without honouring it, "Dear " and
         * "Alex" arrive as "DearAlex".
         */
        line += decodeXml(run[3] ?? "");
      }
    }
    paragraphs.push(line);

    if (paragraphs.length > BINARY_LIMITS.docx.sections * 4) {
      throw new DocumentLimitError("the document has more paragraphs than can be read safely");
    }
  }

  return paragraphs.join("\n");
}

async function parseSharedStrings(xml: string, signal?: AbortSignal): Promise<string[]> {
  const strings: string[] = [];
  let chars = 0;
  const re = /<si\b[^>]*>([\s\S]*?)<\/si>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) {
    if (strings.length >= XLSX_LIMITS.sharedStrings) {
      throw new DocumentLimitError("the shared-string table has too many entries");
    }
    const text = xmlTextNodes(match[1]).slice(0, XLSX_LIMITS.cellChars);
    chars += text.length;
    if (chars > XLSX_LIMITS.sharedStringChars) {
      throw new DocumentLimitError("the shared-string table contains too much text");
    }
    strings.push(text);
    if (strings.length % 1_024 === 0) await cancellationYield(signal);
  }
  assertNotCancelled(signal);
  return strings;
}

function columnIndex(reference: string): number {
  const letters = /^[A-Z]+/i.exec(reference)?.[0]?.toUpperCase() ?? "";
  let value = 0;
  for (const letter of letters) value = value * 26 + letter.charCodeAt(0) - 64;
  return Math.max(0, value - 1);
}

function cellValue(body: string, type: string | null, shared: string[]): string {
  if (type === "inlineStr") return xmlTextNodes(body);
  const raw = /<v\b[^>]*>([\s\S]*?)<\/v>/i.exec(body)?.[1];
  if (raw === undefined) return "";
  const value = decodeXml(raw.replace(/<[^>]+>/g, "")).trim();
  if (type === "s") {
    const index = Number(value);
    return Number.isSafeInteger(index) && index >= 0 ? (shared[index] ?? "") : "";
  }
  if (type === "b") return value === "1" ? "TRUE" : "FALSE";
  return value;
}

async function parseSheet(
  xml: string,
  shared: string[],
  signal?: AbortSignal,
): Promise<{ body: string; readableRows: number }> {
  const lines: string[] = [];
  let readableRows = 0;
  let cells = 0;
  let outputChars = 0;
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(xml))) {
    const values: string[] = [];
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/gi;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRe.exec(rowMatch[1]))) {
      cells += 1;
      if (cells > XLSX_LIMITS.sheetCells) {
        throw new DocumentLimitError("a worksheet has too many cells");
      }
      const ref = xmlAttribute(cellMatch[1], "r") ?? `A${readableRows + 1}`;
      const column = columnIndex(ref);
      if (column >= XLSX_LIMITS.rowColumns) {
        throw new DocumentLimitError(`a worksheet uses columns beyond ${XLSX_LIMITS.rowColumns}`);
      }
      while (values.length < column) values.push("");
      const value = cellValue(cellMatch[2] ?? "", xmlAttribute(cellMatch[1], "t"), shared)
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, XLSX_LIMITS.cellChars);
      values[column] = value;
      if (cells % 1_024 === 0) await cancellationYield(signal);
    }
    const line = values
      .join(" | ")
      .replace(/(?:\s*\|\s*)+$/g, "")
      .trim();
    if (!line) continue;
    readableRows += 1;
    if (readableRows <= MAX_SHEET_ROWS) {
      outputChars += line.length;
      if (outputChars > XLSX_LIMITS.outputChars) {
        throw new DocumentLimitError("worksheet text exceeds the safe output limit");
      }
      lines.push(line);
    }
  }
  const truncated =
    readableRows > MAX_SHEET_ROWS ? `\n…[${readableRows - MAX_SHEET_ROWS} more rows]` : "";
  assertNotCancelled(signal);
  return { body: lines.join("\n") + truncated, readableRows };
}

export async function decodeXlsx(buffer: ArrayBuffer, signal?: AbortSignal): Promise<DecodeResult> {
  if (signal?.aborted) return fail("cancelled", CANCELLED_REASON);
  if (buffer.byteLength > XLSX_LIMITS.inputBytes) {
    return fail(
      "unsupported",
      "This spreadsheet is larger than OCADE's 32 MB local reading limit.",
    );
  }
  if (!looksLikeFormat("xlsx", buffer)) {
    return fail("corrupt", "This spreadsheet could not be read — the file may be damaged.");
  }
  if (startsWith(buffer, OLE)) {
    return fail(
      "unsupported",
      "Legacy .xls spreadsheets aren't supported by the safe local reader. Save it as .xlsx and attach it again.",
    );
  }
  try {
    const entries = parseZip(buffer, XLSX_LIMITS);
    const workbook = await readZipText(buffer, entries, "xl/workbook.xml", signal);
    const relationships = await readZipText(buffer, entries, "xl/_rels/workbook.xml.rels", signal);
    const relationTargets = new Map<string, string>();
    const relationshipRe = /<Relationship\b([^>]*?)(?:\/>|>[\s\S]*?<\/Relationship>)/gi;
    let relationshipMatch: RegExpExecArray | null;
    while ((relationshipMatch = relationshipRe.exec(relationships))) {
      assertNotCancelled(signal);
      if (xmlAttribute(relationshipMatch[1], "TargetMode")?.toLowerCase() === "external") continue;
      const id = xmlAttribute(relationshipMatch[1], "Id");
      const type = xmlAttribute(relationshipMatch[1], "Type") ?? "";
      const target = xmlAttribute(relationshipMatch[1], "Target");
      const resolved = target ? resolveZipTarget("xl/workbook.xml", target) : null;
      if (id && resolved && /\/worksheet$/i.test(type)) relationTargets.set(id, resolved);
    }

    const sheetDefs: Array<{ name: string; path: string }> = [];
    const sheetRe = /<sheet\b([^>]*?)(?:\/>|>[\s\S]*?<\/sheet>)/gi;
    let sheetMatch: RegExpExecArray | null;
    while ((sheetMatch = sheetRe.exec(workbook))) {
      if (sheetDefs.length >= XLSX_LIMITS.workbookSheets) {
        throw new DocumentLimitError(
          `the workbook has more than ${XLSX_LIMITS.workbookSheets} sheets`,
        );
      }
      const name = (xmlAttribute(sheetMatch[1], "name") ?? "Sheet").slice(0, 128);
      const relationId = xmlAttribute(sheetMatch[1], "r:id");
      const path = relationId ? relationTargets.get(relationId) : null;
      if (path) sheetDefs.push({ name, path });
    }

    const sharedEntry = entries.get("xl/sharedStrings.xml");
    const shared = sharedEntry
      ? await parseSharedStrings(
          await readZipText(buffer, entries, "xl/sharedStrings.xml", signal),
          signal,
        )
      : [];
    const sheets = sheetDefs.map((sheet) => sheet.name);
    const sections: DecodedSection[] = [];
    let totalOutput = 0;
    for (const sheet of sheetDefs) {
      assertNotCancelled(signal);
      const parsed = await parseSheet(
        await readZipText(buffer, entries, sheet.path, signal),
        shared,
        signal,
      );
      if (!parsed.body || parsed.readableRows === 0) continue;
      totalOutput += parsed.body.length;
      if (totalOutput > XLSX_LIMITS.outputChars) {
        throw new DocumentLimitError("workbook text exceeds the safe output limit");
      }
      sections.push({ sheet: sheet.name, text: parsed.body });
    }

    if (sections.length === 0) {
      return {
        status: "empty",
        text: "",
        sections: [],
        reason: "This spreadsheet has no readable cells.",
        meta: { sheets },
      };
    }
    const text = sections.map((s) => `[sheet ${s.sheet}]\n${s.text}`).join("\n\n");
    return { status: "ok", text, sections, meta: { sheets, wordCount: countWords(text) } };
  } catch (e) {
    if (e instanceof DecodeCancelledError) return fail("cancelled", CANCELLED_REASON);
    if (e instanceof DocumentLimitError) {
      return fail(
        "unsupported",
        `This spreadsheet exceeds OCADE's safe local reading limits: ${e.message}.`,
      );
    }
    return looksEncrypted(e)
      ? fail("encrypted", "This spreadsheet is protected. Unlock it first, then attach it again.")
      : fail("corrupt", "This spreadsheet could not be read — the file may be damaged.");
  }
}

/* -------------------------------------------------------------- dispatch -- */

export type BinaryKind = "pdf" | "docx" | "xlsx";

export function isDecodableBinary(kind: string): kind is BinaryKind {
  return kind === "pdf" || kind === "docx" || kind === "xlsx";
}

/**
 * Decode a supported binary document. Honours an AbortSignal so a large file can
 * be cancelled, and never throws — failures come back as an honest status.
 */
export async function decodeBinaryDocument(
  kind: BinaryKind,
  buffer: ArrayBuffer,
  signal?: AbortSignal,
): Promise<DecodeResult> {
  // A cancellation is NOT a corrupt file. Reporting it as one told the user
  // their document may be damaged when they simply changed their mind.
  if (signal?.aborted) return fail("cancelled", CANCELLED_REASON);
  const run =
    kind === "pdf" ? decodePdf : kind === "docx" ? decodeDocx : kind === "xlsx" ? decodeXlsx : null;
  if (!run) return fail("unsupported", "OCADE can't read this file type yet.");
  const result = await run(buffer, signal);
  if (signal?.aborted) return fail("cancelled", CANCELLED_REASON);
  return result;
}
