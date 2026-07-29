/**
 * OCADE cited-answer orchestrator — composes claim assessment (§5.1
 * contradiction/authority/syndication) with evidence-snippet location so an
 * answer carries, per supporting source, the exact passage that backs it.
 *
 * This is the execution-path consumer for `evidence-snippet`: it is not called
 * blind, it is called for each supporting source of an assessed claim, using
 * the claim's own terms, and a source whose text does NOT contain the claim's
 * terms yields no snippet — which is surfaced honestly rather than hidden.
 *
 * The honesty of both pieces flows through: the claim's confidence and
 * uncertainties come from `assessClaim` unchanged, and a citation only appears
 * when a real supporting passage was found. A claim OCADE won't state produces
 * no citations, because there is nothing to cite.
 */
import { assessClaim, describeAssessment, type Claim, type Assessment } from "./claim-check";
import { extractSnippet } from "./evidence-snippet";
import { independentSources, type SourceRecord } from "./source-ranking";

export interface Citation {
  sourceId: string;
  publisher: string;
  /** The located supporting passage, verbatim. */
  snippet: string;
  line: number;
  matchedTerms: string[];
}

export interface CitedAnswer {
  assessment: Assessment;
  /** One line summarising confidence + timestamp + uncertainties. */
  summary: string;
  citations: Citation[];
  /** Supporting sources that carried no passage matching the claim's terms. */
  sourcesWithoutEvidence: string[];
}

/** Split a claim's text into search terms (words of 3+ letters, deduped). */
function termsFrom(text: string): string[] {
  const words = text.toLowerCase().match(/[a-z][a-z-]{2,}/g) ?? [];
  // Drop the commonest function words so the snippet locates on substance.
  const stop = new Set([
    "the",
    "and",
    "for",
    "that",
    "this",
    "with",
    "was",
    "were",
    "has",
    "have",
    "will",
    "are",
    "from",
    "into",
    "over",
    "about",
    "their",
    "they",
    "been",
  ]);
  return [...new Set(words.filter((w) => !stop.has(w)))];
}

/**
 * Assess a claim and attach a located citation for each supporting source whose
 * text actually contains the claim's terms.
 *
 * `sourceTexts` maps a source id to the readable text OCADE has for it. A
 * source with no text, or no matching passage, is listed under
 * `sourcesWithoutEvidence` rather than cited — no passage, no citation.
 */
export function buildCitedAnswer(
  claim: Claim,
  sourceTexts: Map<string, string>,
  now: Date = new Date(),
): CitedAnswer {
  const assessment = assessClaim(claim, now);
  const citations: Citation[] = [];
  const without: string[] = [];

  // An unsupported/contested claim OCADE won't state gets no citations — there
  // is nothing to cite for a claim it declined to assert.
  const citeable = assessment.confidence !== "unsupported" && assessment.confidence !== "contested";
  const terms = termsFrom(claim.text);

  if (citeable) {
    for (const source of independentSources(claim.supporting)) {
      const text = sourceTexts.get(source.id);
      if (!text || !text.trim()) {
        without.push(source.publisher);
        continue;
      }
      const snip = extractSnippet(text, terms);
      if (!snip.ok) {
        without.push(source.publisher);
        continue;
      }
      citations.push({
        sourceId: source.id,
        publisher: source.publisher,
        snippet: snip.data.text,
        line: snip.data.line,
        matchedTerms: snip.data.matchedTerms,
      });
    }
  }

  return {
    assessment,
    summary: describeAssessment(assessment),
    citations,
    sourcesWithoutEvidence: without,
  };
}

/** True when a source id maps to text and that text supports the terms — for callers that just want a yes/no. */
export function hasLocatableEvidence(text: string | undefined, claimText: string): boolean {
  if (!text) return false;
  return extractSnippet(text, termsFrom(claimText)).ok;
}

export type { SourceRecord };
