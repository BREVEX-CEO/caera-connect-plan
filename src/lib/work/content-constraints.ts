/**
 * "Write a 200-word essay" — and then checking that it is one.
 *
 * THE BUG THIS EXISTS FOR, MEASURED LIVE
 * ---------------------------------------
 * Asked for a 200-word essay about fast cars, OCADE produced 175 words, wrote
 * them into Notepad, and reported success. Every receipt in the chain was
 * honest: the launch verified a window appeared, the type verified 1,216
 * characters landed in the control, and the read-back verified they were still
 * there. Each step checked the thing it was responsible for. Nobody counted the
 * words, because counting the words was nobody's job.
 *
 * That is a whole class of failure rather than one miss. The user states a
 * measurable property of the OUTPUT — a length, a line count, a number of
 * items — and the pipeline verifies only the MECHANICS of delivery. A 12%
 * shortfall reported as done is the same shape as the router that answered half
 * a compound instruction: mechanically perfect, and not what was asked for.
 *
 * WHAT IS DELIBERATELY NOT HERE
 * ------------------------------
 * No judgement about quality, tone, or whether the essay is any good. Those are
 * not checkable and pretending otherwise would produce confident nonsense. Only
 * properties that can be COUNTED are parsed, because only those can be verified
 * without a second opinion.
 *
 * TOLERANCE IS PART OF THE MEANING, NOT A FUDGE
 * ----------------------------------------------
 * "A 200-word essay" is a request for about two hundred words; 196 satisfies it
 * and nobody would say otherwise. "Exactly 200 words" is a different request
 * and gets no tolerance. Treating the first as strict would send OCADE into a
 * re-prompt loop over a text that was already correct — which costs the user
 * twelve seconds a turn to fix nothing.
 */

/** A property of the output that can be counted and therefore checked. */
export interface ContentConstraint {
  unit: "word" | "line" | "character" | "sentence" | "item";
  /** "about" allows tolerance; "atLeast"/"atMost" are one-sided bounds. */
  kind: "about" | "exactly" | "atLeast" | "atMost";
  count: number;
  /** The phrase this was read from, so a message can quote the user back. */
  source: string;
}

export interface ConstraintCheck {
  ok: boolean;
  /** Every constraint with the measurement that was taken for it. */
  results: Array<{
    constraint: ContentConstraint;
    actual: number;
    ok: boolean;
  }>;
  /** One sentence naming what missed, or null when everything passed. */
  shortfall: string | null;
}

/** Approximate requests get ten per cent either way. */
const TOLERANCE = 0.1;

/**
 * Counting words the way a person would.
 *
 * Hyphenated compounds are one word, as are contractions. Markdown bullets and
 * stray punctuation are not words at all — a model that answers with a bulleted
 * list would otherwise score its bullets as content.
 */
export function countWords(text: string): number {
  return (text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? []).length;
}

export function countLines(text: string): number {
  return text.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
}

export function countSentences(text: string): number {
  return (text.match(/[^.!?]+[.!?]+(\s|$)/g) ?? []).length || (text.trim() ? 1 : 0);
}

/** Numbered or bulleted entries — what "list five things" is asking for. */
export function countItems(text: string): number {
  const bulleted = text.match(/^\s*(?:[-*•]|\d+[.)])\s+\S/gm);
  if (bulleted && bulleted.length > 0) return bulleted.length;
  return countLines(text);
}

const UNIT_WORDS: Record<string, ContentConstraint["unit"]> = {
  word: "word",
  words: "word",
  line: "line",
  lines: "line",
  character: "character",
  characters: "character",
  char: "character",
  chars: "character",
  sentence: "sentence",
  sentences: "sentence",
  item: "item",
  items: "item",
  bullet: "item",
  bullets: "item",
  point: "item",
  points: "item",
};

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  twelve: 12,
  twenty: 20,
  fifty: 50,
  hundred: 100,
};

function asCount(raw: string): number | null {
  const digits = Number(raw.replace(/[,_]/g, ""));
  if (Number.isFinite(digits) && digits > 0) return digits;
  const word = NUMBER_WORDS[raw.toLowerCase()];
  return word ?? null;
}

/**
 * Read every countable constraint out of an instruction.
 *
 * Returns an empty array far more often than not, and that is correct: most
 * requests state no measurable property, and inventing one would make OCADE
 * re-prompt over a target the user never set.
 */
export function parseConstraints(request: string): ContentConstraint[] {
  const text = (request || "").toLowerCase();
  const found: ContentConstraint[] = [];
  const seen = new Set<string>();

  const add = (constraint: ContentConstraint) => {
    const key = `${constraint.unit}:${constraint.kind}:${constraint.count}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push(constraint);
  };

  const units = Object.keys(UNIT_WORDS).join("|");

  // "at least 200 words", "no more than 5 bullets", "under 100 characters"
  const bounded = new RegExp(
    String.raw`\b(at least|no less than|minimum of|no more than|at most|under|fewer than|less than|maximum of)\s+(\d[\d,_]*|${Object.keys(
      NUMBER_WORDS,
    ).join("|")})[\s-]*(${units})\b`,
    "g",
  );
  for (const match of text.matchAll(bounded)) {
    const count = asCount(match[2]);
    if (count === null) continue;
    const lower = /at least|no less than|minimum of/.test(match[1]);
    add({
      unit: UNIT_WORDS[match[3]],
      kind: lower ? "atLeast" : "atMost",
      count,
      source: match[0],
    });
  }

  // "exactly 200 words"
  const exact = new RegExp(
    String.raw`\b(?:exactly|precisely)\s+(\d[\d,_]*|${Object.keys(NUMBER_WORDS).join(
      "|",
    )})[\s-]*(${units})\b`,
    "g",
  );
  for (const match of text.matchAll(exact)) {
    const count = asCount(match[1]);
    if (count === null) continue;
    add({ unit: UNIT_WORDS[match[2]], kind: "exactly", count, source: match[0] });
  }

  /*
   * "a 200-word essay", "200 words", "write five bullets".
   *
   * Run LAST and deduplicated by unit, so "at least 200 words" is not also read
   * as an approximate 200 — the bound is the more specific reading and it is
   * already recorded.
   */
  const approx = new RegExp(
    String.raw`\b(\d[\d,_]*|${Object.keys(NUMBER_WORDS).join("|")})[\s-]*(${units})\b`,
    "g",
  );
  for (const match of text.matchAll(approx)) {
    const count = asCount(match[1]);
    if (count === null) continue;
    const unit = UNIT_WORDS[match[2]];
    if (found.some((existing) => existing.unit === unit)) continue;
    add({ unit, kind: "about", count, source: match[0] });
  }

  return found;
}

export function measure(text: string, unit: ContentConstraint["unit"]): number {
  switch (unit) {
    case "word":
      return countWords(text);
    case "line":
      return countLines(text);
    case "character":
      return text.length;
    case "sentence":
      return countSentences(text);
    case "item":
      return countItems(text);
  }
}

/** Does the produced content satisfy what was asked for? */
export function checkContent(text: string, constraints: ContentConstraint[]): ConstraintCheck {
  const results = constraints.map((constraint) => {
    const actual = measure(text, constraint.unit);
    let ok: boolean;
    switch (constraint.kind) {
      case "exactly":
        ok = actual === constraint.count;
        break;
      case "atLeast":
        ok = actual >= constraint.count;
        break;
      case "atMost":
        ok = actual <= constraint.count;
        break;
      case "about": {
        const slack = Math.max(1, Math.round(constraint.count * TOLERANCE));
        ok = Math.abs(actual - constraint.count) <= slack;
        break;
      }
    }
    return { constraint, actual, ok };
  });

  const missed = results.filter((result) => !result.ok);
  return {
    ok: missed.length === 0,
    results,
    shortfall: missed.length
      ? missed
          .map(
            (result) =>
              `${result.actual} ${result.constraint.unit}${result.actual === 1 ? "" : "s"} ` +
              `where you asked for ${result.constraint.source}`,
          )
          .join("; ")
      : null,
  };
}

/**
 * What to send back to the model so the next attempt is closer.
 *
 * Names the measurement rather than saying "try again", because a model told
 * only that it failed produces another draft of the same length. The direction
 * and the size of the miss are both stated.
 */
export function correctionPrompt(
  original: string,
  produced: string,
  check: ConstraintCheck,
): string {
  const asks = check.results
    .filter((result) => !result.ok)
    .map((result) => {
      const { constraint, actual } = result;
      const direction = actual < constraint.count ? "longer" : "shorter";
      return (
        `It is ${actual} ${constraint.unit}s and needs to be ${constraint.count}. ` +
        `Make it ${direction} by about ${Math.abs(constraint.count - actual)} ${constraint.unit}s.`
      );
    })
    .join(" ");

  return (
    `Rewrite the text below so it meets the length the user asked for. ${asks}\n\n` +
    `The user asked: ${original}\n\n` +
    `Current text:\n${produced}\n\n` +
    `Reply with ONLY the corrected text — no preamble, no explanation, no quotes.`
  );
}

/**
 * The tool arguments that carry authored content, and nothing else.
 *
 * `type_text` into a search box is not authored content, but there is no way to
 * tell that apart from a field here — so the constraint check runs on whatever
 * the model wrote and simply passes when no constraint was stated. That is the
 * safe direction: a false constraint would rewrite somebody's text.
 */
export const CONTENT_FIELDS: Record<string, string> = {
  type_text: "text",
  workspace_write: "content",
  office_write: "content",
  message_draft: "message",
};

/** The authored text inside a call, or null when the call carries none. */
export function contentOf(
  toolName: string,
  args: Record<string, unknown> | undefined,
): { field: string; value: string } | null {
  const field = CONTENT_FIELDS[toolName];
  if (!field || !args) return null;
  const value = args[field];
  if (typeof value !== "string" || value.trim().length === 0) return null;
  return { field, value };
}
