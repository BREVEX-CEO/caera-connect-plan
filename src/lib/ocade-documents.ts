/**
 * OCADE offline document understanding (Plan §18, decision #44).
 *
 * Runs entirely on-device: extraction never uploads a file. Text-based formats
 * (plain text, Markdown, CSV/TSV, JSON, source code) are parsed natively here
 * with zero dependencies, so they work fully offline.
 *
 * Binary formats (PDF, DOCX, XLSX) require a decoder pack that is not installed
 * yet — they return an honest `needs_document_pack` result rather than a fake
 * extraction. Images and video return truthful METADATA only: OCADE does not
 * claim OCR or transcription it cannot perform.
 */

export type DocumentKind =
  | "text"
  | "markdown"
  | "csv"
  | "tsv"
  | "json"
  | "code"
  | "pdf"
  | "docx"
  | "xlsx"
  | "image"
  | "video"
  | "unknown";

export type ExtractStatus = "ok" | "needs_document_pack" | "metadata_only" | "unsupported" | "empty";

export interface DocumentMeta {
  name: string;
  kind: DocumentKind;
  mime: string;
  sizeBytes: number;
  /** Populated for text formats. */
  lineCount?: number;
  wordCount?: number;
  /** Populated for tabular formats. */
  rowCount?: number;
  columnCount?: number;
  columns?: string[];
  /** Populated for code. */
  language?: string;
}

export interface ExtractResult {
  status: ExtractStatus;
  meta: DocumentMeta;
  /** Extracted plain text, ready to include as model context. */
  text: string | null;
  /** Honest, user-facing explanation when text is unavailable. */
  reason?: string;
}

const CODE_EXT_LANGUAGE: Record<string, string> = {
  ts: "TypeScript", tsx: "TypeScript", js: "JavaScript", jsx: "JavaScript",
  py: "Python", rb: "Ruby", go: "Go", rs: "Rust", java: "Java", kt: "Kotlin",
  c: "C", h: "C", cpp: "C++", hpp: "C++", cs: "C#", php: "PHP", swift: "Swift",
  sql: "SQL", sh: "Shell", bash: "Shell", ps1: "PowerShell", yml: "YAML",
  yaml: "YAML", toml: "TOML", html: "HTML", css: "CSS", scss: "SCSS",
};

export function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i + 1).toLowerCase();
}

/** Classify a file by extension first, then MIME. Pure. */
export function classifyFile(name: string, mime = ""): DocumentKind {
  const ext = extensionOf(name);
  if (ext === "md" || ext === "markdown") return "markdown";
  if (ext === "csv") return "csv";
  if (ext === "tsv") return "tsv";
  if (ext === "json") return "json";
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (ext === "xlsx" || ext === "xls") return "xlsx";
  if (ext === "txt" || ext === "log" || ext === "rtf") return "text";
  if (ext in CODE_EXT_LANGUAGE) return "code";

  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime === "application/pdf") return "pdf";
  if (mime.includes("wordprocessingml")) return "docx";
  if (mime.includes("spreadsheetml")) return "xlsx";
  if (mime === "application/json") return "json";
  if (mime.startsWith("text/")) return "text";
  return "unknown";
}

/** True when the kind can be read as UTF-8 text without a decoder pack. */
export function isNativeTextKind(kind: DocumentKind): boolean {
  return kind === "text" || kind === "markdown" || kind === "csv" || kind === "tsv" || kind === "json" || kind === "code";
}

function countWords(text: string): number {
  const m = text.trim().match(/\S+/g);
  return m ? m.length : 0;
}

/**
 * Split a delimited line respecting double quotes ("a,b" stays one field).
 * Pure and dependency-free.
 */
export function splitDelimited(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

export interface TabularSummary {
  columns: string[];
  rowCount: number;
  /** Human-readable preview used as model context. */
  preview: string;
}

/** Summarise CSV/TSV content into columns + a bounded preview. Pure. */
export function summariseTabular(content: string, delimiter: string, maxPreviewRows = 20): TabularSummary {
  const lines = content.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return { columns: [], rowCount: 0, preview: "" };
  const columns = splitDelimited(lines[0], delimiter).map((c) => c.trim());
  const dataLines = lines.slice(1);
  const previewLines = dataLines.slice(0, maxPreviewRows);
  const preview = [
    `Columns (${columns.length}): ${columns.join(", ")}`,
    `Rows: ${dataLines.length}`,
    previewLines.length > 0 ? `\nFirst ${previewLines.length} row(s):` : "",
    ...previewLines.map((l) => splitDelimited(l, delimiter).join(" | ")),
  ]
    .filter(Boolean)
    .join("\n");
  return { columns, rowCount: dataLines.length, preview };
}

export const DOCUMENT_PACK_REASON =
  "This file type needs the OCADE document pack, which isn't installed yet. Plain text, Markdown, CSV, JSON and code files work offline today.";

export const IMAGE_METADATA_REASON =
  "OCADE reads images with a vision engine rather than text extraction. Only file details are available here.";

export const VIDEO_METADATA_REASON =
  "OCADE can list video file details, but it does not transcribe video yet — no transcript is available.";

/**
 * Extract model-ready text from an already-read file. `content` is the decoded
 * UTF-8 string for text kinds; binary kinds ignore it. Pure and offline.
 */
export function extractDocument(input: {
  name: string;
  mime?: string;
  sizeBytes: number;
  content?: string;
}): ExtractResult {
  const kind = classifyFile(input.name, input.mime ?? "");
  const meta: DocumentMeta = {
    name: input.name,
    kind,
    mime: input.mime ?? "",
    sizeBytes: input.sizeBytes,
  };

  if (kind === "image") {
    return { status: "metadata_only", meta, text: null, reason: IMAGE_METADATA_REASON };
  }
  if (kind === "video") {
    return { status: "metadata_only", meta, text: null, reason: VIDEO_METADATA_REASON };
  }
  if (kind === "pdf" || kind === "docx" || kind === "xlsx") {
    return { status: "needs_document_pack", meta, text: null, reason: DOCUMENT_PACK_REASON };
  }
  if (!isNativeTextKind(kind)) {
    return {
      status: "unsupported",
      meta,
      text: null,
      reason: "OCADE can't read this file type offline yet.",
    };
  }

  const content = input.content ?? "";
  if (content.trim().length === 0) {
    return { status: "empty", meta, text: null, reason: "This file is empty." };
  }

  meta.lineCount = content.split(/\r?\n/).length;
  meta.wordCount = countWords(content);

  if (kind === "csv" || kind === "tsv") {
    const summary = summariseTabular(content, kind === "csv" ? "," : "\t");
    meta.columns = summary.columns;
    meta.columnCount = summary.columns.length;
    meta.rowCount = summary.rowCount;
    return { status: "ok", meta, text: summary.preview };
  }

  if (kind === "code") {
    meta.language = CODE_EXT_LANGUAGE[extensionOf(input.name)] ?? "Unknown";
  }

  if (kind === "json") {
    try {
      const parsed: unknown = JSON.parse(content);
      const topLevel = Array.isArray(parsed)
        ? `array of ${parsed.length}`
        : parsed && typeof parsed === "object"
          ? `object with keys: ${Object.keys(parsed as Record<string, unknown>).slice(0, 30).join(", ")}`
          : typeof parsed;
      return { status: "ok", meta, text: `JSON (${topLevel})\n\n${content}` };
    } catch {
      return { status: "ok", meta, text: content };
    }
  }

  return { status: "ok", meta, text: content };
}

/** Bound extracted text so a large file can't blow the model context. */
export function clampForContext(text: string, maxChars = 24_000): { text: string; truncated: boolean } {
  if (text.length <= maxChars) return { text, truncated: false };
  return {
    text: text.slice(0, maxChars) + `\n\n…[truncated ${text.length - maxChars} characters]`,
    truncated: true,
  };
}
