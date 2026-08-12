import { splitIntoPassages, describePassage, type Passage } from "./passages";
import { rankPassages, tokenise } from "./bm25";

/**
 * Choosing what the engine actually reads.
 *
 * The rules here are all about not lying to the user about what was read:
 *
 *  - A SHORT DOCUMENT IS SENT WHOLE. Retrieval that fires when it is not needed
 *    can only lose information. Below the budget there is nothing to gain.
 *  - NOTHING RELEVANT MEANS SAY SO. When no passage shares a term with the
 *    question, the beginning of the document is sent and the fact that the
 *    search found nothing is reported. Handing over the top-scoring passage of
 *    a set that all scored zero would present an unrelated paragraph as the
 *    relevant one.
 *  - WHAT WAS LEFT OUT IS COUNTED. The caller gets the numbers so the screen
 *    can say "searched 61 sections, used 4" rather than implying the whole file
 *    was read.
 */

export interface RetrievalSource {
  /** Citation marker id, e.g. "S1". */
  id: string;
  name: string;
  text: string;
}

export interface SelectedPassage {
  sourceId: string;
  sourceName: string;
  passage: Passage;
  /** Human phrase for where it came from, e.g. "lines 147-149". */
  locator: string;
  score: number;
}

export interface RetrievalResult {
  /** Passages to send, in document order within each source. */
  selected: SelectedPassage[];
  /** Every passage the documents were cut into. */
  totalPassages: number;
  /** True when everything fitted and no search was needed. */
  sentWhole: boolean;
  /**
   * True when the question matched nothing at all and the opening of the
   * document was sent instead. The user has to be told this.
   */
  noMatch: boolean;
  /**
   * True when something matched, but less than half of the question's terms
   * were found anywhere in the chosen passages.
   *
   * This is the state that produces a confident answer built on one incidental
   * word, so it is reported rather than smoothed over: "found some of what you
   * asked about" is a different claim from "found what you asked about", and
   * the user is the one who can tell whether the difference matters.
   */
  weakMatch: boolean;
  /** Question terms actually found, so the screen can name them. */
  matchedTerms: string[];
  /** Question terms searched for and not found anywhere. */
  missingTerms: string[];
  charsSelected: number;
  charsAvailable: number;
}

/**
 * Below this, searching cannot help.
 *
 * Roughly 1,700 tokens at the estimator's rate — about two minutes of reading
 * on a machine without acceleration, which is the point where trimming starts
 * to be worth more than completeness.
 */
export const RETRIEVAL_THRESHOLD_CHARS = 6_000;

/** How much of a long document is sent once retrieval is in play. */
export const RETRIEVAL_BUDGET_CHARS = 4_000;

/**
 * Below this share of the question's terms, a match is reported as weak.
 *
 * Half is not arbitrary: at or above it the passage carries the majority of
 * what was asked, and below it the passage was chosen on a minority of the
 * question — often one incidental word — which is exactly when a lexical
 * search looks confident and is wrong.
 */
const WEAK_MATCH_RATIO = 0.5;

export function selectRelevantPassages(
  query: string,
  sources: RetrievalSource[],
  options: { thresholdChars?: number; budgetChars?: number } = {},
): RetrievalResult {
  const threshold = options.thresholdChars ?? RETRIEVAL_THRESHOLD_CHARS;
  const budget = options.budgetChars ?? RETRIEVAL_BUDGET_CHARS;
  const charsAvailable = sources.reduce((sum, source) => sum + source.text.length, 0);
  const queryTerms = [...new Set(tokenise(query))];

  const all: SelectedPassage[] = [];
  for (const source of sources) {
    for (const passage of splitIntoPassages(source.text)) {
      all.push({
        sourceId: source.id,
        sourceName: source.name,
        passage,
        locator: describePassage(passage),
        score: 0,
      });
    }
  }

  if (charsAvailable <= threshold) {
    // Nothing was searched, so there is nothing to report as found or missing.
    // Claiming a term was "matched" here would describe a search that never ran.
    return {
      selected: all,
      totalPassages: all.length,
      sentWhole: true,
      noMatch: false,
      weakMatch: false,
      matchedTerms: [],
      missingTerms: [],
      charsSelected: charsAvailable,
      charsAvailable,
    };
  }

  /*
   * Ranked across ALL documents at once rather than per document. Asking "which
   * file mentions the refund policy" should be able to answer from one file and
   * spend nothing on the other four; a per-document quota would force every
   * file to contribute whether or not it had anything to say.
   */
  const ranked = rankPassages(
    query,
    all.map((entry) => entry.passage),
  );
  const byPassage = new Map<Passage, SelectedPassage>(all.map((entry) => [entry.passage, entry]));

  const scored = ranked
    .map((row) => {
      const entry = byPassage.get(row.passage);
      return entry ? { ...entry, score: row.score, matched: row.matched } : null;
    })
    .filter((row): row is SelectedPassage & { matched: string[] } => row !== null);

  const anyMatch = scored.some((row) => row.score > 0);

  const chosen: SelectedPassage[] = [];
  const found = new Set<string>();
  let used = 0;
  if (anyMatch) {
    for (const row of scored) {
      if (row.score <= 0) break;
      if (used + row.passage.text.length > budget) continue;
      const { matched, ...selected } = row;
      chosen.push(selected);
      for (const term of matched) found.add(term);
      used += row.passage.text.length;
    }
  }

  if (chosen.length === 0) {
    // Nothing matched, or the single best passage was bigger than the whole
    // budget. Send the opening — a document's first lines carry its title,
    // headers and summary more often than any other part — and report it.
    for (const row of all) {
      if (used + row.passage.text.length > budget) break;
      chosen.push(row);
      used += row.passage.text.length;
    }
    return {
      selected: chosen,
      totalPassages: all.length,
      sentWhole: false,
      noMatch: true,
      weakMatch: false,
      matchedTerms: [],
      missingTerms: queryTerms,
      charsSelected: used,
      charsAvailable,
    };
  }

  // Back into reading order. Passages delivered in score order read as a jumble
  // and invite the model to treat a later passage as following an earlier one.
  chosen.sort(
    (a, b) => a.sourceId.localeCompare(b.sourceId) || a.passage.startLine - b.passage.startLine,
  );

  const matchedTerms = queryTerms.filter((term) => found.has(term));
  const missingTerms = queryTerms.filter((term) => !found.has(term));

  return {
    selected: chosen,
    totalPassages: all.length,
    sentWhole: false,
    noMatch: false,
    weakMatch: matchedTerms.length / queryTerms.length < WEAK_MATCH_RATIO,
    matchedTerms,
    missingTerms,
    charsSelected: used,
    charsAvailable,
  };
}

/**
 * One sentence for the screen.
 *
 * Never claims the whole document was read when it was not. This is the
 * sentence that keeps the feature honest: the speed comes from reading less,
 * and the user is entitled to know that is what happened.
 */
export function describeRetrieval(result: RetrievalResult): string | null {
  if (result.sentWhole) return null;
  if (result.noMatch) {
    return `Nothing in the attached text matched that question, so OCADE read the opening ${result.selected.length} of ${result.totalPassages} document sections instead.`;
  }
  const base = `Searched ${result.totalPassages} document sections and used the best ${result.selected.length}.`;
  if (!result.weakMatch) return base;
  // A weak match is still a match, so the count stays — but the sentence must
  // not let the count imply the question was answered. Naming the terms that
  // were NOT found is the part a user can act on.
  const missing = result.missingTerms.slice(0, 4).join(", ");
  return `${base} Only part of your question was found${missing ? ` — no mention of ${missing}` : ""}, so the answer may not be in this document.`;
}
