/**
 * OCADE citations — answer-to-source mapping (Plan §18).
 *
 * OCADE cites what it actually read. Attached documents are indexed with stable
 * ids ([S1], [S2] …) plus a locator (line / sheet column / section). The model is
 * instructed to mark claims with those ids; this module parses the markers back
 * into citation cards and strips them from the displayed prose.
 *
 * Honesty rules baked in:
 *  - a marker that doesn't match an indexed source is DISCARDED, never rendered
 *    as a citation (the model cannot invent a source);
 *  - sources OCADE could not read (needs_document_pack / metadata_only) are
 *    indexed as `readable: false` and are never cited as if their content was
 *    understood.
 *
 * Pure and dependency-free.
 */
import type { DocumentKind, ExtractResult } from "./ocade-documents";

export interface SourceLocator {
  /** 1-based line number for text/code. */
  line?: number;
  /** Sheet or table name for spreadsheets/CSV. */
  sheet?: string;
  /** Page number for paginated documents. */
  page?: number;
  /** Heading/section title for structured docs. */
  section?: string;
}

export interface IndexedSource {
  /** Stable marker id, e.g. "S1". */
  id: string;
  name: string;
  kind: DocumentKind;
  /** False when OCADE could not actually read the content. */
  readable: boolean;
  /** Why it is unreadable — surfaced instead of a fake citation. */
  unreadableReason?: string;
  /** Bounded text used as model context. */
  text: string | null;
  locator: SourceLocator;
}

export interface Citation {
  sourceId: string;
  name: string;
  kind: DocumentKind;
  locator: SourceLocator;
  /** Short quoted evidence from the source, when locatable. */
  snippet: string | null;
  /**
   * Where a WEB source lives. Absent for an attached file, and that absence is
   * the distinction the receipt is built on.
   *
   * A reader has to be able to tell "OCADE read this off a page this morning"
   * from "OCADE read this out of the document you gave it" from "OCADE knew
   * this already" — those three carry completely different weight, and a
   * citation list that renders them identically is worse than no list at all.
   */
  url?: string;
  /** When OCADE fetched it. Distinct from when the source says it was true. */
  retrievedAt?: string;
  /** What the source itself claimed as its date, where it said so. */
  asOf?: string | null;
}

/**
 * Whether a citation URL may be rendered as a link.
 *
 * Citations are persisted to localStorage and read back, so the store is
 * writable by anything that can run script in this origin — and a citation is
 * rendered as an anchor. `javascript:` in an href is script execution on
 * click, which turns a corrupted or poisoned citation record into stored XSS.
 * Only http(s) is ever linked; anything else is shown as inert text.
 */
export function safeCitationHref(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/** Build a stable, ordered source index from extraction results. */
export function buildSourceIndex(results: ExtractResult[]): IndexedSource[] {
  return results.map((r, i) => ({
    id: `S${i + 1}`,
    name: r.meta.name,
    kind: r.meta.kind,
    readable: r.status === "ok",
    unreadableReason: r.status === "ok" ? undefined : r.reason,
    text: r.text,
    locator: locatorFor(r),
  }));
}

/**
 * Choose the most specific locator the extraction supports: a page for PDFs, a
 * sheet for workbooks, a column set for CSV, otherwise a line. Never invents a
 * position the extractor could not determine.
 */
function locatorFor(r: ExtractResult): SourceLocator {
  if (r.meta.pageCount && r.meta.pageCount > 0) return { page: 1 };
  if (r.meta.sheets?.length) return { sheet: r.meta.sheets[0] };
  if (r.meta.columns?.length) return { sheet: r.meta.name };
  if (r.meta.lineCount) return { line: 1 };
  return {};
}

/**
 * System-prompt fragment instructing the model to cite indexed sources.
 * Only readable sources are offered for citation.
 */
export function citationInstruction(sources: IndexedSource[]): string {
  const readable = sources.filter((s) => s.readable);
  if (readable.length === 0) return "";
  const list = readable.map((s) => `${s.id} = ${s.name}`).join("; ");
  return (
    `You have been given these source documents: ${list}. ` +
    `When a statement comes from a source, mark it inline with the matching id in square brackets, e.g. [S1]. ` +
    `Only cite ids from that list. Never invent a source id, and never cite a document you were not given. ` +
    `If the answer does not come from a source, do not add a marker.`
  );
}

const MARKER = /\[(S\d+)\]/g;

/**
 * Extract citations from an answer. Unknown or unreadable ids are dropped so a
 * fabricated marker can never become a citation card.
 */
/**
 * A quoted phrase in the sentence containing a citation marker.
 *
 * When the answer quotes the source directly, that quote is far better evidence
 * than the document's opening line — and it lets the locator point at the line
 * the claim actually came from.
 */
function quotedNear(answer: string, markerIndex: number): string | null {
  // Bound the search to the sentence around the marker so a quote from an
  // unrelated paragraph is never attributed to this citation.
  const start = Math.max(0, answer.lastIndexOf(".", markerIndex) + 1);
  const endDot = answer.indexOf(".", markerIndex);
  const sentence = answer.slice(start, endDot === -1 ? answer.length : endDot);

  const quote = /["“”']([^"“”']{8,200})["“”']/.exec(sentence);
  return quote ? quote[1].trim() : null;
}

export function parseCitations(answer: string, sources: IndexedSource[]): Citation[] {
  const byId = new Map(sources.map((s) => [s.id, s]));
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const m of answer.matchAll(MARKER)) {
    const id = m[1];
    if (seen.has(id)) continue;
    const src = byId.get(id);
    if (!src || !src.readable) continue; // never cite what wasn't read
    seen.add(id);

    /*
     * Prefer the phrase the answer actually quoted, and locate it in the source
     * so the citation points at the right line. Falling back to the document's
     * first line — the previous behaviour — showed "evidence" that had nothing
     * to do with the claim being cited.
     *
     * The quote is only used once it is CONFIRMED present in the source text;
     * an invented quote must never be presented as evidence.
     */
    const quoted = quotedNear(answer, m.index ?? 0);
    const quotedLine = quoted ? locateSnippet(src.text, quoted) : null;

    out.push({
      sourceId: src.id,
      name: src.name,
      kind: src.kind,
      locator: quotedLine ? { ...src.locator, line: quotedLine } : src.locator,
      snippet: quotedLine ? quoted : firstMeaningfulLine(src.text),
    });
  }
  return out;
}

/** Remove citation markers from prose for clean display. */
export function stripCitationMarkers(answer: string): string {
  return answer
    .replace(MARKER, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([.,;:])/g, "$1")
    .trim();
}

/** True when the answer references at least one valid source. */
export function hasCitations(answer: string, sources: IndexedSource[]): boolean {
  return parseCitations(answer, sources).length > 0;
}

function firstMeaningfulLine(text: string | null): string | null {
  if (!text) return null;
  const line = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (!line) return null;
  return line.length > 180 ? line.slice(0, 180) + "…" : line;
}

/** Human-readable locator, e.g. "line 12" or "sheet Budget". */
export function describeLocator(loc: SourceLocator): string | null {
  if (loc.page) return `page ${loc.page}`;
  if (loc.sheet) return `sheet ${loc.sheet}`;
  if (loc.section) return loc.section;
  if (loc.line) return `line ${loc.line}`;
  return null;
}

/**
 * Locate a snippet inside a source and return its 1-based line, so a citation
 * can point at the exact line when the model quotes text.
 */
export function locateSnippet(text: string | null, snippet: string): number | null {
  if (!text || !snippet.trim()) return null;
  const needle = snippet.trim().toLowerCase();
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes(needle)) return i + 1;
  }
  return null;
}
