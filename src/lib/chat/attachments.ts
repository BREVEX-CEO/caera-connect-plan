/**
 * TURNING A FILE INTO SOMETHING OCADE CAN ACTUALLY READ.
 *
 * Attachments used to go to the Library and stop there: a person attached a
 * spreadsheet, OCADE said it was saved, and the answer was written as though
 * no file existed. This is the step that was missing.
 *
 * WHAT IT WILL AND WILL NOT DO, and the difference matters more than the list:
 * it reads what the browser can read natively — text, Markdown, CSV, JSON,
 * source code — and it hands images over whole for the online engine to look
 * at. It does not open PDFs, Word documents or Excel workbooks, and it says so
 * plainly rather than extracting the readable fragments of a binary container
 * and presenting the result as the document's contents. A partial reading that
 * looks complete is worse than a refusal, because the answer built on it looks
 * complete too.
 *
 * THE NAME TRAVELS WITH THE CONTENT. Every attachment is labelled where the
 * model sees it, so an answer can say which file a figure came from and a
 * person can check it. Tabular text keeps its header row for the same reason:
 * "the third row of sales.csv" is checkable and "your data says" is not.
 */
import type { NormalizedAttachment } from "@/lib/intelligence/contract";

/** How many files may ride with one question. Matches the boundary's own cap. */
export const MAX_ATTACHMENTS = 8;

/**
 * Extracted text per attachment, in characters. Roughly fifty pages.
 *
 * Truncation is announced in the text itself rather than done silently: a
 * model told nothing about the cut will answer as though it read the whole
 * file, and confidently.
 */
export const MAX_TEXT_CHARS = 200_000;

/** An image, decoded. Comfortably above a phone photograph. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Everything one question may carry, so a request cannot be unbounded. */
export const MAX_TOTAL_BYTES = 20 * 1024 * 1024;

const TEXT_EXTENSIONS =
  /\.(txt|md|markdown|csv|tsv|json|jsonl|ya?ml|toml|ini|cfg|conf|log|sql|html?|css|scss|xml|svg|js|jsx|mjs|cjs|ts|tsx|py|rb|go|rs|java|kt|swift|c|h|cpp|hpp|cs|sh|bash|zsh|php|r|jl|lua|dart|vue|svelte)$/i;

export interface PendingAttachment {
  /** Stable within this composer, so remove and reorder have something to name. */
  id: string;
  name: string;
  mime: string;
  sizeBytes: number;
  /** Ready to send, or the reason it is not. */
  state: "reading" | "ready" | "rejected";
  reason?: string;
  text?: string;
  /** Base64 without a data-URL prefix, as the boundary expects. */
  image?: string;
}

function isText(file: File): boolean {
  return file.type.startsWith("text/") || TEXT_EXTENSIONS.test(file.name);
}

/** A refusal a person can act on: what OCADE cannot read, and what it can. */
function unreadable(mime: string, name: string): string {
  if (/pdf/i.test(mime) || /\.pdf$/i.test(name)) {
    return "OCADE cannot read PDFs yet. Paste the part you want, or attach it as text.";
  }
  if (
    /word|officedocument|opendocument|excel|powerpoint|\.(docx?|xlsx?|pptx?|odt|ods|odp)$/i.test(
      `${mime} ${name}`,
    )
  ) {
    return "OCADE cannot read that document format yet. Export it as text or CSV and attach that.";
  }
  if (/^(audio|video)\//.test(mime)) return "OCADE cannot listen to or watch files.";
  return "OCADE cannot read that kind of file.";
}

/**
 * Read one file for the model.
 *
 * Never throws: a file that cannot be read becomes a rejection with a reason,
 * because the composer has to show something either way and an exception here
 * would take the other attachments with it.
 */
export async function readAttachment(file: File, id: string): Promise<PendingAttachment> {
  const base = {
    id,
    name: file.name,
    mime: file.type || "application/octet-stream",
    sizeBytes: file.size,
  };

  try {
    if (file.type.startsWith("image/")) {
      if (file.size > MAX_IMAGE_BYTES) {
        return { ...base, state: "rejected", reason: "That image is too large to send." };
      }
      return { ...base, state: "ready", image: await toBase64(file) };
    }

    if (isText(file)) {
      const raw = await file.text();
      if (raw.trim().length === 0) {
        return { ...base, state: "rejected", reason: "That file is empty." };
      }
      const text =
        raw.length > MAX_TEXT_CHARS
          ? `${raw.slice(0, MAX_TEXT_CHARS)}\n\n[This file was longer than OCADE can read at once; the text above is the first part of it.]`
          : raw;
      return { ...base, state: "ready", text };
    }

    return { ...base, state: "rejected", reason: unreadable(base.mime, file.name) };
  } catch {
    return { ...base, state: "rejected", reason: "That file could not be read." };
  }
}

/** What the boundary is sent: ready attachments only, within the total budget. */
export function forRequest(pending: PendingAttachment[]): NormalizedAttachment[] {
  const out: NormalizedAttachment[] = [];
  let budget = MAX_TOTAL_BYTES;

  for (const attachment of pending) {
    if (attachment.state !== "ready") continue;
    const cost = attachment.image ? attachment.image.length : (attachment.text?.length ?? 0);
    if (cost > budget) break;
    budget -= cost;
    out.push({
      name: attachment.name,
      mime: attachment.mime,
      sizeBytes: attachment.sizeBytes,
      ...(attachment.image ? { image: attachment.image } : { text: attachment.text }),
    });
  }
  return out;
}

/**
 * The instruction that makes an answer checkable.
 *
 * Sent only when there is something to cite. A standing instruction about files
 * on every request is tokens spent on nothing, and a model told to cite sources
 * that do not exist will invent one.
 */
export function citationInstruction(attachments: NormalizedAttachment[]): string | null {
  if (attachments.length === 0) return null;
  return (
    "The person has attached files, each marked with its name. When an answer uses " +
    "something from one, say which file it came from and where in it — a heading, a " +
    "line, a row, a column. If a file does not contain what was asked for, say so " +
    "rather than answering from anything else."
  );
}

async function toBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  // Chunked: spreading a multi-megabyte array into `fromCharCode` at once
  // overflows the argument list and throws.
  for (let at = 0; at < bytes.length; at += 8192) {
    binary += String.fromCharCode(...bytes.subarray(at, at + 8192));
  }
  return btoa(binary);
}
