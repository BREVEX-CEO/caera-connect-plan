/**
 * Cutting a document into passages that can be found again.
 *
 * WHY THIS EXISTS. OCADE used to send the whole of every attachment to the
 * engine. On a datacentre GPU that is merely wasteful; on the hardware this
 * product runs on it is the difference between usable and not. Measured here,
 * from the engine's own counters: a 20,000-character log came to 5,654 tokens
 * and took 458 SECONDS to read, after which the answer itself took 3.8. The
 * user waits eight minutes for a machine to re-read a document it will use four
 * lines of.
 *
 * So the document is cut into passages, the question picks the few that matter,
 * and only those are sent. Reading cost falls with the number of tokens, so
 * this is not a small optimisation — it is what makes attachments work at all
 * on a laptop.
 *
 * LINE NUMBERS ARE CARRIED THROUGH, and that is not a detail. OCADE cites where
 * an answer came from; a passage that has lost its position can only be cited
 * as "somewhere in this file", which is the same as not citing it.
 */

export interface Passage {
  /** Text of the passage, verbatim. */
  text: string;
  /** 1-based line where this passage starts in the original document. */
  startLine: number;
  /** 1-based line where it ends, inclusive. */
  endLine: number;
}

export interface PassageOptions {
  /**
   * Target size. Small enough that an irrelevant passage costs little, large
   * enough to hold a whole paragraph or table row with its heading.
   */
  maxChars?: number;
  /**
   * Lines repeated from the end of one passage at the start of the next.
   *
   * Without overlap a fact that straddles a cut is in NEITHER passage well
   * enough to be found: the sentence introducing it lands in one and the number
   * in the other, and a query mentioning both matches neither strongly.
   */
  overlapLines?: number;
}

const DEFAULT_MAX_CHARS = 900;
const DEFAULT_OVERLAP_LINES = 1;

/**
 * Split on line boundaries, never mid-line.
 *
 * A cut inside a line splits a table row or a code statement in half, and both
 * halves become unmatchable. Lines are the smallest unit that still means
 * something on its own, and they are also what a citation locator refers to.
 */
export function splitIntoPassages(text: string, options: PassageOptions = {}): Passage[] {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const overlapLines = options.overlapLines ?? DEFAULT_OVERLAP_LINES;
  if (!text.trim()) return [];

  const lines = text.split("\n");
  const passages: Passage[] = [];

  let current: string[] = [];
  let currentStart = 1;
  let length = 0;

  const flush = (endLine: number) => {
    if (current.length === 0) return;
    const body = current.join("\n");
    if (body.trim()) passages.push({ text: body, startLine: currentStart, endLine });
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const lineNumber = i + 1;

    /*
     * A single line longer than the whole budget becomes its own passage rather
     * than being dropped or splitting the budget maths. Minified JSON and
     * one-line CSV exports both look like this, and silently losing them would
     * be the worst possible failure — the document appears to have been read.
     */
    if (line.length >= maxChars) {
      flush(lineNumber - 1);
      passages.push({ text: line, startLine: lineNumber, endLine: lineNumber });
      current = [];
      length = 0;
      currentStart = lineNumber + 1;
      continue;
    }

    if (length + line.length + 1 > maxChars && current.length > 0) {
      flush(lineNumber - 1);
      // Carry the tail forward so a fact spanning the cut survives in one piece.
      const carried = current.slice(Math.max(0, current.length - overlapLines));
      currentStart = lineNumber - carried.length;
      current = [...carried];
      length = carried.reduce((sum, l) => sum + l.length + 1, 0);
    }

    if (current.length === 0) currentStart = lineNumber;
    current.push(line);
    length += line.length + 1;
  }

  flush(lines.length);
  return passages;
}

/** How a passage should be labelled when it is handed to the engine. */
export function describePassage(passage: Passage): string {
  return passage.startLine === passage.endLine
    ? `line ${passage.startLine}`
    : `lines ${passage.startLine}-${passage.endLine}`;
}
