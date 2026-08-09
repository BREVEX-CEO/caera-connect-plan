/**
 * Ranking passages by how well they answer the question — with no model.
 *
 * WHY LEXICAL, AND WHY THAT IS THE RIGHT CHOICE HERE. The obvious alternative
 * is embeddings, and on a server that is what you would reach for. On this
 * hardware it is self-defeating: embedding a document costs the same prompt
 * evaluation the retrieval exists to avoid — measured at 12.3 tokens per second
 * — so embedding 5,654 tokens to save reading 5,654 tokens saves nothing. It
 * also needs a second model resident in memory the machine does not have.
 *
 * BM25 needs no model, no download, no memory and no network. It runs in
 * milliseconds on any machine OCADE will ever meet, it is deterministic, and
 * for the thing people actually attach documents for — "find the part that
 * mentions X" — it is strong. It is genuinely weaker at "find the part that
 * MEANS X in other words", and that limit is stated rather than hidden: the
 * caller falls back to sending more of the document when nothing scores well.
 *
 * DIGITS ARE TERMS. `742913`, `Q4-2026` and `v2.1.3` are exactly what people
 * search their own documents for, and a tokeniser that throws away numbers —
 * as many do — would miss every one of them.
 */

import type { Passage } from "./passages";

/** BM25 saturation: how quickly repeating a term stops adding to the score. */
const K1 = 1.2;
/** BM25 length normalisation: how much a long passage is penalised. */
const B = 0.75;

/**
 * Words carried by nearly every sentence, which therefore separate nothing.
 *
 * Kept deliberately short. An aggressive stop list starts removing words that
 * carry meaning in a technical document — "not", "all", "no" invert a clause,
 * and dropping them makes a passage match its own opposite.
 */
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "was",
  "were",
  "what",
  "which",
  "with",
]);

/** Split text into comparable terms. Letters and digits both count. */
export function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((term) => term.length > 1 && !STOP_WORDS.has(term));
}

export interface ScoredPassage {
  passage: Passage;
  score: number;
  /** Query terms this passage actually contains, for explaining the choice. */
  matched: string[];
}

/**
 * Score every passage against the question.
 *
 * Returns them sorted, highest first. A score of zero means the passage shares
 * no query term at all — the caller must treat that as "found nothing", not as
 * "least bad", because handing over an unrelated passage and calling it the
 * relevant one is worse than admitting the search failed.
 */
export function rankPassages(query: string, passages: Passage[]): ScoredPassage[] {
  const queryTerms = [...new Set(tokenise(query))];
  if (queryTerms.length === 0 || passages.length === 0) {
    return passages.map((passage) => ({ passage, score: 0, matched: [] }));
  }

  const tokenised = passages.map((passage) => tokenise(passage.text));
  const lengths = tokenised.map((terms) => terms.length);
  const averageLength = lengths.reduce((sum, n) => sum + n, 0) / (lengths.length || 1);

  // How many passages contain each term at all. A term in every passage
  // distinguishes nothing and its weight falls to about zero, which is how
  // BM25 handles boilerplate without needing it listed anywhere.
  const documentFrequency = new Map<string, number>();
  for (const terms of tokenised) {
    for (const term of new Set(terms)) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }

  const total = passages.length;
  const scored = passages.map((passage, index) => {
    const terms = tokenised[index];
    const counts = new Map<string, number>();
    for (const term of terms) counts.set(term, (counts.get(term) ?? 0) + 1);

    let score = 0;
    const matched: string[] = [];
    for (const term of queryTerms) {
      const frequency = counts.get(term);
      if (!frequency) continue;
      matched.push(term);
      const containing = documentFrequency.get(term) ?? 0;
      // Standard BM25 IDF, with the +0.5/+1 smoothing that keeps a term
      // appearing in every passage at a small positive weight rather than a
      // negative one.
      const idf = Math.log(1 + (total - containing + 0.5) / (containing + 0.5));
      const normalised = frequency * (K1 + 1);
      const denominator = frequency + K1 * (1 - B + (B * lengths[index]) / (averageLength || 1));
      score += idf * (normalised / denominator);
    }
    return { passage, score, matched };
  });

  return scored.sort((a, b) => b.score - a.score || a.passage.startLine - b.passage.startLine);
}
