/**
 * OCADE evidence snippets (master plan §5.1 "evidence snippets").
 *
 * A citation is only worth something if it points at the passage that actually
 * supports the claim. This finds that passage in a source's text — a verbatim
 * window around the densest cluster of the claim's terms — and reports where it
 * is, so a citation can quote real evidence with a real location.
 *
 * THE RULE: no supporting passage, no snippet. If none of the claim's terms
 * appear in the source, this returns a refusal — it does NOT hand back the top
 * of the document as though it were evidence. A snippet that doesn't contain
 * the thing it's cited for is a fabricated citation, which the truthfulness
 * contract forbids outright. Every snippet returned is a verbatim substring of
 * the source and contains at least one matched term.
 */

export type SnippetOutcome<T> =
  { ok: true; data: T; evidence: string } | { ok: false; reason: string };

export interface Snippet {
  /** Verbatim text from the source. */
  text: string;
  /** Character offset of the snippet's start in the source. */
  offset: number;
  /** 1-based line the snippet starts on. */
  line: number;
  /** Which of the requested terms actually appear in the snippet. */
  matchedTerms: string[];
}

export interface SnippetOptions {
  /** Approximate snippet length in characters. */
  windowChars?: number;
}

/** A word occurrence: the term it matched and where it starts. */
interface Hit {
  term: string;
  index: number;
}

/**
 * Find the passage in `sourceText` that best supports the given terms.
 *
 * Terms are matched as whole words, case-insensitively. The window with the
 * most DISTINCT terms wins (density of distinct evidence, not raw repetition of
 * one word), with ties broken toward the tighter cluster.
 */
export function extractSnippet(
  sourceText: string,
  terms: string[],
  opts: SnippetOptions = {},
): SnippetOutcome<Snippet> {
  const windowChars = opts.windowChars ?? 240;
  if (!sourceText.trim()) return { ok: false, reason: "The source has no text to quote from." };

  const meaningful = terms.map((t) => t.trim().toLowerCase()).filter((t) => t.length >= 2);
  if (meaningful.length === 0) {
    return {
      ok: false,
      reason: "No usable search terms were given, so OCADE can't locate a supporting passage.",
    };
  }
  const wanted = [...new Set(meaningful)];

  // Collect whole-word hits for every term.
  const hits: Hit[] = [];
  for (const term of wanted) {
    const re = new RegExp(`\\b${escapeRegExp(term)}\\b`, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(sourceText)) !== null) {
      hits.push({ term, index: m.index });
      if (m.index === re.lastIndex) re.lastIndex++; // guard against zero-width
    }
  }

  if (hits.length === 0) {
    // The rule: refuse rather than return an unsupported passage.
    return {
      ok: false,
      reason:
        "None of the claim's terms appear in this source, so there is no passage that supports it. OCADE won't quote an unrelated excerpt as evidence.",
    };
  }

  hits.sort((a, b) => a.index - b.index);

  // Slide a window over the hits; score by distinct terms it covers.
  let best = { start: 0, distinct: 0, span: Infinity, terms: [] as string[] };
  for (let i = 0; i < hits.length; i++) {
    const windowStart = hits[i].index;
    const windowEnd = windowStart + windowChars;
    const inWindow = hits.filter((h) => h.index >= windowStart && h.index < windowEnd);
    const distinct = new Set(inWindow.map((h) => h.term));
    const span = inWindow[inWindow.length - 1].index - windowStart;
    if (distinct.size > best.distinct || (distinct.size === best.distinct && span < best.span)) {
      best = { start: windowStart, distinct: distinct.size, span, terms: [...distinct] };
    }
  }

  // Expand to word/sentence boundaries so the quote reads cleanly, then clamp.
  const rawStart = best.start;
  const start = Math.max(0, backToBoundary(sourceText, rawStart));
  const end = Math.min(sourceText.length, forwardToBoundary(sourceText, rawStart + windowChars));
  const text = sourceText.slice(start, end).trim();

  // Verify the returned text genuinely contains a matched term — the invariant.
  const contained = wanted.filter((t) => new RegExp(`\\b${escapeRegExp(t)}\\b`, "i").test(text));
  if (contained.length === 0) {
    return {
      ok: false,
      reason:
        "OCADE couldn't extract a passage that actually contains the terms, so it won't return one.",
    };
  }

  const line = sourceText.slice(0, start).split("\n").length;
  return {
    ok: true,
    data: { text, offset: start, line, matchedTerms: contained },
    evidence: `Found a supporting passage at line ${line} covering ${contained.length} of ${wanted.length} term(s): ${contained.join(", ")}.`,
  };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Walk back to the start of the current word, but not past a sentence break. */
function backToBoundary(text: string, index: number): number {
  let i = index;
  while (i > 0 && /\S/.test(text[i - 1]) && !/[.!?\n]/.test(text[i - 1])) i--;
  return i;
}

/** Walk forward to the end of the current word or the next sentence break. */
function forwardToBoundary(text: string, index: number): number {
  let i = Math.min(index, text.length);
  while (i < text.length && /\S/.test(text[i]) && !/[.!?\n]/.test(text[i])) i++;
  // Include a trailing sentence terminator if we landed on one.
  if (i < text.length && /[.!?]/.test(text[i])) i++;
  return i;
}
