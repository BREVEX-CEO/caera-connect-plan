/** The loss-of-detail check behind Enhance prompt (plan 14E.2.5): pure, so it is tested alone. */

/**
 * Details of the original that the suggestion does not contain word for word: numbers, quoted
 * text, URLs, paths, @names, and negations. Each is shown to the person before they apply it.
 */
export function lostDetails(original: string, suggestion: string): string[] {
  const patterns = [
    /"[^"\n]{1,200}"|'[^'\n]{2,200}'|`[^`\n]{1,200}`/g, // quoted text
    /\bhttps?:\/\/[^\s)]+/gi, // URLs
    /(?:[A-Za-z]:\\|~\/|\.{0,2}\/)?(?:[\w.-]+[\\/])+[\w.-]+/g, // paths
    /@[\w.-]+/g, // @ resources
    /\d+(?:[.,]\d+)*(?:\s?(?:%|[a-zA-Z]{1,4}\b))?/g, // numbers and units
  ];
  const lost = new Set<string>();
  for (const pattern of patterns) {
    for (const match of original.match(pattern) ?? []) {
      if (!suggestion.includes(match.trim())) lost.add(match.trim());
    }
  }
  const negations = /\b(?:not|never|no|don't|do not|without|except|avoid|must not|cannot)\b/gi;
  const before = (original.match(negations) ?? []).length;
  const after = (suggestion.match(negations) ?? []).length;
  if (after < before) lost.add(`${before - after} negation(s) such as "not" or "never"`);
  return [...lost];
}
