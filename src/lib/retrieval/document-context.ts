/**
 * Turning attached documents into the context OCADE actually sends.
 *
 * This is the seam between extraction (`ocade-documents`) and the engine. It
 * exists as its own module rather than inside the chat screen because it makes
 * three claims to the user that must be testable on their own:
 *
 *  1. WHAT WAS READ. Long attachments are searched, not read end to end, and
 *     the sentence on screen says so with real numbers.
 *  2. WHAT COULD NOT BE READ. A PDF that needs a decoder, an empty file, a
 *     cancelled read and an unsupported type are four different situations and
 *     each keeps its own reason. None of them may quietly become "no context".
 *  3. WHAT IS NOT TRUSTED. Every byte that came from a file is wrapped as
 *     untrusted data before it reaches any engine.
 *
 * Held together by one rule: OCADE never says it searched a document when
 * retrieval did not run, and never presents document text it did not read.
 */
import { citationInstruction, type IndexedSource } from "../ocade-citations";
import { wrapUntrustedContent } from "../ocade-injection-guard";
import {
  selectRelevantPassages,
  describeRetrieval,
  type RetrievalResult,
  type RetrievalSource,
} from "./select";

/** A source OCADE was given but could not read, with the real reason. */
export interface UnreadableSource {
  name: string;
  reason: string;
}

export interface DocumentContextResult {
  /** Context block for the engine, or undefined when there is nothing to send. */
  context?: string;
  /**
   * One sentence for the screen, or null when there is nothing to declare —
   * a short document read whole needs no explanation.
   */
  notice: string | null;
  /** Present only when a search actually ran. Null means no retrieval happened. */
  retrieval: RetrievalResult | null;
  /** Files that were attached but contributed nothing, each with its reason. */
  unreadable: UnreadableSource[];
}

/**
 * Bound on the assembled block, matching the server's own cap on
 * `documentContext`. Retrieval normally lands far below this; the clamp is the
 * backstop for the short-document path, where everything is sent whole.
 */
export const DOCUMENT_CONTEXT_MAX_CHARS = 24_000;

/**
 * Build the document context for one question.
 *
 * `question` is the message being sent. It is what makes retrieval possible at
 * all: without it there is no way to tell which part of a 200-page file matters,
 * and the only honest fallback is to send the opening and say so.
 */
export function buildDocumentContext(
  question: string,
  sources: IndexedSource[],
): DocumentContextResult {
  const unreadable: UnreadableSource[] = sources
    .filter((source) => !source.readable || !source.text?.trim())
    .map((source) => ({
      name: source.name,
      reason:
        source.unreadableReason ??
        (source.readable
          ? "This file had no readable text in it."
          : "OCADE could not read this file."),
    }));

  const readable: Array<{ source: IndexedSource; text: string }> = sources
    .filter((source) => source.readable && source.text?.trim())
    .map((source) => ({ source, text: source.text as string }));

  if (readable.length === 0) {
    return {
      context: undefined,
      notice: unreadable.length > 0 ? describeUnreadable(unreadable) : null,
      retrieval: null,
      unreadable,
    };
  }

  const retrievalSources: RetrievalSource[] = readable.map(({ source, text }) => ({
    id: source.id,
    name: source.name,
    text,
  }));

  const result = selectRelevantPassages(question, retrievalSources);

  /*
   * Passages are grouped back under their source and labelled with the id the
   * citation parser already understands, so a retrieved answer can still be
   * cited to a line. Sending passages ungrouped would give the engine a list of
   * fragments with no way to say which file any of them came from.
   */
  const bySource = new Map<string, string[]>();
  for (const row of result.selected) {
    const lines = bySource.get(row.sourceId) ?? [];
    // The locator travels with the passage. Without it a citation degrades to
    // "somewhere in this file", which is the same as no citation.
    lines.push(result.sentWhole ? row.passage.text : `(${row.locator})\n${row.passage.text}`);
    bySource.set(row.sourceId, lines);
  }

  const blocks: string[] = [];
  for (const { source } of readable) {
    const chunks = bySource.get(source.id);
    if (!chunks || chunks.length === 0) continue;
    const wrapped = wrapUntrustedContent(chunks.join("\n\n…\n\n"), source.name).text;
    blocks.push(`[${source.id}] ${source.name}\n${wrapped}`);
  }

  if (blocks.length === 0) {
    // Every readable source dropped out of the selection. This is possible only
    // when the budget could not fit even one passage; saying "searched and used
    // nothing" is the truth, and sending an empty block would not be.
    return {
      context: undefined,
      notice: "OCADE could not fit any part of the attached document into this request.",
      retrieval: result,
      unreadable,
    };
  }

  const instruction = citationInstruction(readable.map(({ source }) => source));
  const searchNote = result.sentWhole
    ? ""
    : "Only the sections listed below were retrieved from these documents. " +
      "Do not claim knowledge of any other part of them.";

  const body = [instruction, searchNote, blocks.join("\n\n")]
    .filter((part) => part.length > 0)
    .join("\n\n");

  const notices = [
    describeRetrieval(result),
    unreadable.length > 0 ? describeUnreadable(unreadable) : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" ");

  return {
    context: body.slice(0, DOCUMENT_CONTEXT_MAX_CHARS),
    notice: notices.length > 0 ? notices : null,
    retrieval: result,
    unreadable,
  };
}

/**
 * Name the files that contributed nothing, and why.
 *
 * Listed by name rather than counted: "1 file could not be read" leaves the
 * user guessing which of their four attachments was ignored.
 */
function describeUnreadable(unreadable: UnreadableSource[]): string {
  if (unreadable.length === 1) {
    return `${unreadable[0].name} was not read — ${lowerFirst(unreadable[0].reason)}`;
  }
  return `${unreadable.length} attachments were not read: ${unreadable
    .map((entry) => `${entry.name} (${lowerFirst(entry.reason)})`)
    .join("; ")}`;
}

function lowerFirst(text: string): string {
  return text.length > 0 ? text[0].toLowerCase() + text.slice(1) : text;
}
