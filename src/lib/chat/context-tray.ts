/**
 * What OCADE will actually read when you press send.
 *
 * THE PROBLEM. By the time a question is sent, its context has been assembled
 * from several places the user cannot see: files attached to this message,
 * files saved to the project, and local memory. The user finds out what was
 * consulted only afterwards, from a sentence under the reply — and only if
 * they read it. If OCADE answered from the wrong document, or from a file they
 * forgot was attached to the project three weeks ago, there was no moment at
 * which they could have noticed.
 *
 * The tray moves that disclosure BEFORE the send, where it can still be acted
 * on, and makes each entry removable. It is the difference between an
 * explanation and a control.
 *
 * WHY IT STATES THE TREATMENT, NOT JUST THE NAME. "report.pdf" tells you
 * nothing about whether OCADE will read all of it. A 200-page document is
 * searched and only the best few sections are used; a short note is sent whole.
 * Those are materially different answers to "did it read my document", and the
 * tray says which one applies to each file, using the same threshold the
 * retrieval code uses rather than a second guess at it.
 */

import { RETRIEVAL_THRESHOLD_CHARS } from "../retrieval/select";

export type ContextOrigin = "attachment" | "project" | "memory";

/** How a source will be handled when the question is sent. */
export type ContextTreatment = "whole" | "searched" | "unreadable";

export interface ContextEntry {
  id: string;
  name: string;
  origin: ContextOrigin;
  treatment: ContextTreatment;
  /** Characters of extracted text. Zero for an unreadable source. */
  chars: number;
  /** Why this source contributes nothing, when it does not. */
  reason?: string;
  /** False for sources the user cannot detach from here (local memory). */
  removable: boolean;
}

export interface ContextInput {
  attachments: Array<{ name: string; extractedText?: string | null; unreadableReason?: string }>;
  projectFiles: Array<{ id: string; name: string; text: string }>;
  /** Characters of local memory that will be prepended, if enabled. */
  memoryChars?: number;
}

/**
 * Build the tray.
 *
 * Pure, and deliberately does not run retrieval: retrieval needs the question,
 * and the tray must be correct while the composer is still empty. It reports
 * the TREATMENT each source will receive, which is decided by length alone and
 * is knowable in advance.
 */
export function buildContextTray(input: ContextInput): ContextEntry[] {
  const entries: ContextEntry[] = [];

  for (const [index, attachment] of input.attachments.entries()) {
    const text = attachment.extractedText ?? "";
    entries.push({
      id: `attachment:${index}`,
      name: attachment.name,
      origin: "attachment",
      // An attachment with no extracted text is listed rather than hidden. It
      // is on screen in the composer, so omitting it here would read as "this
      // will be used" by absence of any statement to the contrary.
      treatment: text.length === 0 ? "unreadable" : treatmentFor(text.length),
      chars: text.length,
      reason:
        text.length === 0
          ? (attachment.unreadableReason ??
            "No text could be read from this file, so it will not be part of the answer.")
          : undefined,
      removable: true,
    });
  }

  for (const file of input.projectFiles) {
    entries.push({
      id: `project:${file.id}`,
      name: file.name,
      origin: "project",
      treatment: treatmentFor(file.text.length),
      chars: file.text.length,
      removable: true,
    });
  }

  if (input.memoryChars && input.memoryChars > 0) {
    entries.push({
      id: "memory",
      name: "What you have asked OCADE to remember",
      origin: "memory",
      treatment: "whole",
      chars: input.memoryChars,
      // Turned off in Settings → Memory, not detached per message: silently
      // dropping it for one question would make the next answer inconsistent
      // with the last for a reason the user could not reconstruct.
      removable: false,
    });
  }

  return entries;
}

function treatmentFor(chars: number): ContextTreatment {
  return chars > RETRIEVAL_THRESHOLD_CHARS ? "searched" : "whole";
}

/** One line describing what will happen to a source. */
export function describeEntry(entry: ContextEntry): string {
  switch (entry.treatment) {
    case "unreadable":
      return entry.reason ?? "Nothing could be read from this.";
    case "whole":
      return entry.origin === "memory"
        ? "Included with every question in this project."
        : "Short enough to be read in full.";
    case "searched":
      // Named as a search rather than as "read", because it is one.
      return "Too long to read whole — OCADE will search it and use the closest sections.";
  }
}

/**
 * A single honest sentence for the whole tray.
 *
 * Returns null when there is nothing attached, so the caller renders no tray
 * at all rather than an empty box announcing emptiness.
 */
export function summariseTray(entries: ContextEntry[]): string | null {
  if (entries.length === 0) return null;

  const usable = entries.filter((e) => e.treatment !== "unreadable");
  if (usable.length === 0) {
    return "Nothing here can be read, so this question will be answered without it.";
  }

  const searched = usable.filter((e) => e.treatment === "searched").length;
  const noun = usable.length === 1 ? "source" : "sources";
  if (searched === 0) {
    return `${usable.length} ${noun}, each read in full.`;
  }
  if (searched === usable.length) {
    return `${usable.length} ${noun}, searched for the parts that match your question.`;
  }
  return `${usable.length} ${noun}: ${searched} searched, the rest read in full.`;
}
